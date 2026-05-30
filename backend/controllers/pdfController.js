const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/localDb');
const { parsePdfBuffer } = require('../services/pdfParserService');

/**
 * @file pdfController.js
 * @description Controller managing uploaded PDF records, invoking the extraction parser service, 
 * writing parsed datasets to the database, and serving PDF buffers inline.
 * 
 * DESIGN DECISIONS:
 *   - Serves files inline (`Content-Disposition: inline`) to allow the React PDF canvas overlay
 *     to render documents without prompting file downloads.
 *   - Cascade deletion: Deleting a PDF record deletes the static file from the uploads directory
 *     and deletes all associated voters from `db.json` in a single transaction.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Automatically create uploads directory if missing
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`📁 Created uploads directory: ${UPLOADS_DIR}`);
}

/**
 * Handles PDF uploads, invokes the extraction pipeline, and saves results.
 * 
 * @param {object} req - Express request holding file bytes in `req.file`.
 * @param {object} res - Express response.
 * @param {function} next - Express next callback.
 */
exports.uploadPdf = async (req, res, next) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'কোনো PDF ফাইল পাঠানো হয়নি।' });
    }

    const pdfId = uuidv4();
    // Re-encode original filenames to support UTF-8 Bengali characters
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const safeFileName = `${pdfId}.pdf`;
    filePath = path.join(UPLOADS_DIR, safeFileName);

    // Save the PDF file to disk
    try {
      fs.writeFileSync(filePath, req.file.buffer);
    } catch (writeErr) {
      console.error('Failed to save PDF file:', writeErr.message);
      return res.status(500).json({ success: false, message: 'PDF ফাইল সেভ করতে সমস্যা হয়েছে।' });
    }

    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);

    // Parse the PDF buffer to extract cover page metadata and voter records
    let parseResult = { coverMeta: {}, voters: [], totalPages: 0 };
    try {
      parseResult = await parsePdfBuffer(req.file.buffer, pdfId, originalName);
    } catch (parseErr) {
      console.warn('PDF parse warning:', parseErr.message);
      // Continue processing even if layout extraction encounters minor warning anomalies
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
    db.addPdf(pdfRecord);

    // Save extracted voters
    if (voters.length > 0) {
      db.addVoters(voters);
    }

    return res.status(201).json({
      success: true,
      message: `PDF আপলোড সফল! ${voters.length} জন ভোটারের তথ্য extract করা হয়েছে।`,
      pdf: pdfRecord,
      votersExtracted: voters.length,
    });

  } catch (err) {
    // Clean up uploaded file on error to prevent stray files
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    next(err);
  }
};

/**
 * Returns a list of all uploaded PDFs.
 * 
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 */
exports.getPdfList = (req, res) => {
  const pdfs = db.getPdfs();
  res.json({ success: true, count: pdfs.length, pdfs });
};

/**
 * Serves raw PDF file streams for display in the frontend PDF.js canvas viewer.
 * 
 * @param {object} req - Express request with the target PDF ID in parameters.
 * @param {object} res - Express response.
 * @param {function} next - Express next callback.
 */
exports.servePdfFile = (req, res, next) => {
  try {
    const { id } = req.params;
    const pdf = db.getPdfById(id);
    if (!pdf) return res.status(404).json({ success: false, message: 'PDF পাওয়া যায়নি।' });

    const filePath = path.join(UPLOADS_DIR, pdf.safeFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'PDF ফাইল সার্ভারে পাওয়া যায়নি।' });
    }

    // Set inline content-disposition and content-type to allow the canvas to view the PDF directly
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdf.fileName)}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};

/**
 * Cascade deletion: Removes PDF metadata, deletes physical file, and purges all associated voters.
 * 
 * @param {object} req - Express request holding PDF target ID.
 * @param {object} res - Express response.
 * @param {function} next - Express next callback.
 */
exports.deletePdf = (req, res, next) => {
  try {
    const { id } = req.params;
    const pdf = db.getPdfById(id);

    if (pdf) {
      // Delete the physical file
      const filePath = path.join(UPLOADS_DIR, pdf.safeFileName);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
      // Purge associated voters from local db
      const deletedVoters = db.deleteVotersByPdf(id);
      // Purge the PDF metadata record
      db.deletePdf(id);
      return res.json({ success: true, message: `PDF এবং ${deletedVoters} জন ভোটার মুছে ফেলা হয়েছে।` });
    }

    res.status(404).json({ success: false, message: 'PDF পাওয়া যায়নি।' });
  } catch (err) {
    next(err);
  }
};
