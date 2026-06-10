'use strict';

/**
 * @file ocrService.js
 * @description OCR fallback service for scanned/image-based PDFs.
 *
 * When pdfjs-dist cannot extract text (image-only pages), this service:
 *   1. Renders each PDF page to a canvas image using pdfjs-dist + node-canvas
 *   2. Runs Tesseract.js OCR with Bengali (ben) language model
 *   3. Applies Unicode cleanup and correction pipeline
 *   4. Returns structured text for the parser
 *
 * DEPENDENCIES (optional — graceful fallback if not installed):
 *   npm install tesseract.js canvas
 *
 * @version 7.0.0
 */

const logger = require('../utils/logger');
const { autoConvert } = require('../utils/bengaliUnicodeConverter');
const { correctText } = require('../utils/dictionaryCorrector');

/**
 * Check if OCR dependencies are available.
 * @returns {{ available: boolean, missing: string[] }}
 */
function checkDependencies() {
  const missing = [];

  try { require('tesseract.js'); } catch { missing.push('tesseract.js'); }
  try { require('canvas'); } catch { missing.push('canvas'); }

  return { available: missing.length === 0, missing };
}

/**
 * Render a PDF page to a PNG image buffer using pdfjs-dist + node-canvas.
 *
 * @param {object} page - pdfjs page object
 * @param {number} scale - Render scale (2.0 = 2x resolution for better OCR)
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function renderPageToImage(page, scale = 2.0) {
  const { createCanvas } = require('canvas');
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  // pdfjs-dist renderPage requires a canvas-like context
  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return canvas.toBuffer('image/png');
}

/**
 * Run Tesseract OCR on an image buffer.
 *
 * @param {Buffer} imageBuffer - PNG image data
 * @param {string} lang - Tesseract language code (default: 'ben' for Bengali)
 * @returns {Promise<string>} Extracted text
 */
async function ocrImage(imageBuffer, lang = 'ben') {
  const Tesseract = require('tesseract.js');

  const worker = await Tesseract.createWorker(lang);
  const { data: { text } } = await worker.recognize(imageBuffer);
  await worker.terminate();

  return text || '';
}

/**
 * Process a scanned PDF: render pages to images → OCR → cleanup → return text.
 *
 * @param {Buffer|Uint8Array} buffer - Raw PDF bytes
 * @param {string} pdfId - PDF identifier
 * @param {string} fileName - Original filename for logging
 * @returns {Promise<object>} Parser-compatible result object
 */
async function processScannedPdf(buffer, pdfId, fileName) {
  const deps = checkDependencies();

  if (!deps.available) {
    logger.warn(`OCR dependencies missing: ${deps.missing.join(', ')}. Install with: npm install ${deps.missing.join(' ')}`);
    return {
      coverMeta: { district: '', upazila: '', unionName: '', wardNo: '', voterArea: '', voterAreaNo: '', totalVoters: 0, totalMaleVoters: 0, totalFemaleVoters: 0, genderType: 'পুরুষ', publicationDate: '', postCode: '' },
      voters: [],
      totalPages: 0,
      rawTextLength: 0,
      pdfType: 'scanned',
      encoding: 'unknown',
      warning: `OCR dependencies not installed. Run: npm install ${deps.missing.join(' ')}`,
    };
  }

  logger.info(`OCR processing scanned PDF: ${fileName}`, pdfId);

  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const uint8 = new Uint8Array(buffer.buffer || buffer, buffer.byteOffset || 0, buffer.length || buffer.byteLength);

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({
      data: uint8,
      useSystemFonts: false,
      standardFontDataUrl: null,
    }).promise;
  } catch (err) {
    logger.error('Failed to load PDF for OCR', err, pdfId);
    return {
      coverMeta: { district: '', upazila: '', unionName: '', wardNo: '', voterArea: '', voterAreaNo: '', totalVoters: 0, totalMaleVoters: 0, totalFemaleVoters: 0, genderType: 'পুরুষ', publicationDate: '', postCode: '' },
      voters: [],
      totalPages: 0,
      rawTextLength: 0,
      pdfType: 'scanned',
      encoding: 'unknown',
      warning: `PDF load failed: ${err.message}`,
    };
  }

  const totalPages = pdf.numPages;
  const maxPages = Math.min(totalPages, 30); // Cap OCR at 30 pages (slow process)
  const allText = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);

      // Render page to image
      const imageBuffer = await renderPageToImage(page, 2.5);

      // OCR the image
      const rawText = await ocrImage(imageBuffer, 'ben');

      // Clean up OCR output
      const { text: cleanText } = autoConvert(rawText, null);
      const corrected = correctText(cleanText);

      allText.push(corrected.corrected || cleanText);

      logger.debug(`OCR Page ${pageNum}: ${rawText.length} chars → ${(corrected.corrected || cleanText).length} chars`, pdfId);

      page.cleanup();
    } catch (err) {
      logger.warn(`OCR failed on page ${pageNum}: ${err.message}`, pdfId);
      allText.push('');
    }
  }

  await pdf.destroy();

  const fullText = allText.join('\n');
  logger.info(`OCR complete: ${totalPages} pages, ${fullText.length} chars extracted`, pdfId);

  return {
    coverMeta: { district: '', upazila: '', unionName: '', wardNo: '', voterArea: '', voterAreaNo: '', totalVoters: 0, totalMaleVoters: 0, totalFemaleVoters: 0, genderType: 'পুরুষ', publicationDate: '', postCode: '' },
    voters: [],
    totalPages,
    rawTextLength: fullText.length,
    pdfType: 'scanned',
    encoding: 'ocr',
    ocrText: fullText,
    warning: maxPages < totalPages
      ? `OCR processed ${maxPages} of ${totalPages} pages (capped for performance).`
      : undefined,
  };
}

module.exports = {
  processScannedPdf,
  checkDependencies,
  renderPageToImage,
  ocrImage,
};
