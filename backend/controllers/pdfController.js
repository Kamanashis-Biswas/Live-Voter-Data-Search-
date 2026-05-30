const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/localDb');
const { parsePdfBuffer } = require('../services/pdfParserService');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

/**
 * POST /api/pdf/upload
 * Upload actual PDF file, parse it, extract voters, store everything locally.
 */
exports.uploadPdf = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'কোনো PDF ফাইল পাঠানো হয়নি।' });
    }

    const pdfId = uuidv4();
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const safeFileName = `${pdfId}.pdf`;
    const filePath = path.join(UPLOADS_DIR, safeFileName);

    // Save the PDF file to disk
    fs.writeFileSync(filePath, req.file.buffer);

    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);

    // Parse PDF to extract cover metadata and voter records
    let parseResult = { coverMeta: {}, voters: [], totalPages: 0 };
    try {
      parseResult = await parsePdfBuffer(req.file.buffer, pdfId, originalName);
    } catch (parseErr) {
      console.warn('PDF parse warning:', parseErr.message);
      // Continue even if parsing fails partially
    }

    const { coverMeta, voters, totalPages } = parseResult;

    // Build PDF metadata record
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
    next(err);
  }
};

/**
 * GET /api/pdf/list
 * Returns list of all uploaded PDFs.
 */
exports.getPdfList = (req, res) => {
  const pdfs = db.getPdfs();
  res.json({ success: true, count: pdfs.length, pdfs });
};

/**
 * GET /api/pdf/:id/file
 * Serves the actual PDF file for viewing in browser.
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdf.fileName)}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/pdf/:id
 * Delete PDF record and its file and associated voters.
 */
exports.deletePdf = (req, res, next) => {
  try {
    const { id } = req.params;
    const pdf = db.getPdfById(id);

    if (pdf) {
      // Delete actual file
      const filePath = path.join(UPLOADS_DIR, pdf.safeFileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      // Delete associated voters
      const deletedVoters = db.deleteVotersByPdf(id);
      // Delete PDF record
      db.deletePdf(id);
      return res.json({ success: true, message: `PDF এবং ${deletedVoters} জন ভোটার মুছে ফেলা হয়েছে।` });
    }

    res.status(404).json({ success: false, message: 'PDF পাওয়া যায়নি।' });
  } catch (err) {
    next(err);
  }
};
