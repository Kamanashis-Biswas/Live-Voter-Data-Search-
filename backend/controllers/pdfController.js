const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const { parsePdfBuffer } = require('../services/pdfParserService');
const logger = require('../utils/logger');
const { supabaseAdmin } = require('../config/supabaseClient');

const hasSupabase = !!supabaseAdmin;

/**
 * @file pdfController.js
 * @description Controller managing uploaded PDF records, invoking the extraction parser service, 
 * writing parsed datasets to the database, and serving PDF buffers inline.
 * 
 * @author Kamanashis Biswas
 * @version 6.0.0
 */

const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Automatically create uploads directory if missing (only needed for local backup)
if (!hasSupabase && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  logger.info(`Created uploads directory: ${UPLOADS_DIR}`);
}

/**
 * Handles PDF uploads, invokes the extraction pipeline, and saves results.
 */
exports.uploadPdf = async (req, res, next) => {
  let filePath = null;
  const pdfId = uuidv4();
  const safeFileName = `${pdfId}.pdf`;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'কোনো PDF ফাইল পাঠানো হয়নি।' });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    filePath = path.join(UPLOADS_DIR, safeFileName);

    if (hasSupabase) {
      // 1. Upload the PDF file to Supabase Storage bucket 'voter-pdfs'
      try {
        const { error: uploadErr } = await supabaseAdmin.storage
          .from('voter-pdfs')
          .upload(safeFileName, req.file.buffer, {
            contentType: 'application/pdf',
            upsert: true
          });
        if (uploadErr) throw uploadErr;
        logger.info(`PDF uploaded to Supabase Storage: ${safeFileName}`, pdfId);
      } catch (err) {
        logger.error('Failed to upload PDF to Supabase Storage', err, pdfId);
        return res.status(500).json({ success: false, message: 'Supabase Cloud Storage-এ PDF আপলোড করতে সমস্যা হয়েছে।' });
      }
    } else {
      // Local disk fallback
      try {
        fs.writeFileSync(filePath, req.file.buffer);
      } catch (writeErr) {
        logger.error('Failed to save PDF file locally', writeErr, pdfId);
        return res.status(500).json({ success: false, message: 'PDF ফাইল সেভ করতে সমস্যা হয়েছে।' });
      }
    }

    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);

    // Parse the PDF buffer to extract cover page metadata and voter records
    let parseResult = { coverMeta: {}, voters: [], totalPages: 0 };
    try {
      parseResult = await parsePdfBuffer(req.file.buffer, pdfId, originalName);
    } catch (parseErr) {
      logger.warn(`PDF parse warning for ${originalName}: ${parseErr.message}`, pdfId);
    }

    const { coverMeta, voters, totalPages } = parseResult;

    // Create the PDF metadata record
    const pdfRecord = {
      id: pdfId,
      fileName: originalName,
      safeFileName,
      fileSize: `${fileSizeMB} MB`,
      totalPages,
      district: coverMeta.district || req.body.district || '',
      upazila: coverMeta.upazila || req.body.upazila || '',
      unionName: coverMeta.unionName || req.body.unionName || '',
      wardNo: coverMeta.wardNo || req.body.wardNo || '',
      voterArea: coverMeta.voterArea || req.body.voterArea || '',
      voterAreaNo: coverMeta.voterAreaNo || req.body.voterAreaNo || '',
      totalVoters: coverMeta.totalVoters || 0,
      totalMaleVoters: coverMeta.totalMaleVoters || 0,
      totalFemaleVoters: coverMeta.totalFemaleVoters || 0,
      genderType: coverMeta.genderType || 'পুরুষ',
      publicationDate: coverMeta.publicationDate || '',
      postCode: coverMeta.postCode || '',
      voterCount: voters.length,
      status: 'সফল',
      uploadedAt: new Date().toISOString(),
    };

    // Save PDF record
    await db.addPdf(pdfRecord);

    // Save extracted voters
    if (voters.length > 0) {
      await db.addVoters(voters);
    }

    return res.status(201).json({
      success: true,
      message: `PDF আপলোড সফল! ${voters.length} জন ভোটারের তথ্য extract করা হয়েছে।`,
      pdf: pdfRecord,
      votersExtracted: voters.length,
    });

  } catch (err) {
    // Clean up uploaded file on error to prevent stray files
    if (hasSupabase) {
      supabaseAdmin.storage.from('voter-pdfs').remove([safeFileName]).catch(() => {});
    } else if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    next(err);
  }
};

/**
 * Returns a list of all uploaded PDFs.
 */
exports.getPdfList = async (req, res, next) => {
  try {
    const pdfs = await db.getPdfs();
    res.json({ success: true, count: pdfs.length, pdfs });
  } catch (err) {
    next(err);
  }
};

/**
 * Serves raw PDF file streams for display in the frontend PDF.js canvas viewer.
 */
exports.servePdfFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdf = await db.getPdfById(id);
    if (!pdf) return res.status(404).json({ success: false, message: 'PDF পাওয়া যায়নি।' });

    if (hasSupabase) {
      // Download the PDF from Supabase storage and send buffer inline
      const { data, error } = await supabaseAdmin.storage
        .from('voter-pdfs')
        .download(pdf.safeFileName);
        
      if (error) {
        logger.error('Failed to download PDF from Supabase Storage', error);
        return res.status(404).json({ success: false, message: 'PDF ফাইল ক্লাউড স্টোরেজে পাওয়া যায়নি।' });
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdf.fileName)}"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(buffer);
    } else {
      // Local disk file serving
      const filePath = path.join(UPLOADS_DIR, pdf.safeFileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'PDF ফাইল সার্ভারে পাওয়া যায়নি।' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdf.fileName)}"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(filePath);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Cascade deletion: Removes PDF metadata, deletes physical file, and purges all associated voters.
 */
exports.deletePdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pdf = await db.getPdfById(id);

    if (pdf) {
      if (hasSupabase) {
        // Delete from Supabase Storage
        const { error } = await supabaseAdmin.storage
          .from('voter-pdfs')
          .remove([pdf.safeFileName]);
        if (error) {
          logger.warn(`Failed to delete PDF from Supabase Storage: ${pdf.safeFileName}`, error);
        }
      } else {
        // Delete the physical local file
        const filePath = path.join(UPLOADS_DIR, pdf.safeFileName);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
      }
      
      // Purge associated voters
      const deletedVoters = await db.deleteVotersByPdf(id);
      // Purge the PDF metadata record
      await db.deletePdf(id);
      
      return res.json({ success: true, message: `PDF এবং ${deletedVoters} জন ভোটার মুছে ফেলা হয়েছে।` });
    }

    res.status(404).json({ success: false, message: 'PDF পাওয়া যায়নি।' });
  } catch (err) {
    next(err);
  }
};
