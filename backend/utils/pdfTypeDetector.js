'use strict';

/**
 * @file pdfValidator.js
 * @description Comprehensive PDF Verification Engine.
 *
 * Validates PDF integrity, detects type, and classifies encoding:
 *  • 'text'         — Has embedded text with standard Unicode (searchable, correct)
 *  • 'legacy_font'  — Has embedded text with legacy Bengali font encoding (SutonnyMJ/Bijoy)
 *  • 'scanned'      — Image-only PDF with no embedded text (needs OCR)
 *
 * Also performs:
 *  - PDF header integrity check
 *  - Encrypted PDF detection
 *  - Per-page text vs image analysis
 *  - Corrupted page detection
 *  - Font name analysis
 *
 * @version 6.0.0 — Renamed from pdfTypeDetector.js, expanded with full verification
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const { legacyRatio, controlRangeRatio } = require('./bengaliUnicodeConverter');

const BENGALI_RE = /[\u0980-\u09FF]/;

// Known Unicode Bengali fonts — these do NOT need conversion
const UNICODE_FONT_KEYWORDS = [
  'unicode', 'noto', 'solaimanlipi', 'bangla', 'vrinda',
  'nikosh', 'kalpurush', 'siyam', 'adarshalipi', 'banglatype',
  'shonarbangla', 'lohit', 'freesans', 'freeserif',
];

// Known legacy fonts — these DO need conversion
const LEGACY_FONT_KEYWORDS = [
  'sutonny', 'bijoy', 'akaash', 'muktinarrow', 'adarsha',
  'shreelipi', 'boishakhi', 'prothom', 'kalpana',
];

/**
 * Verify PDF buffer integrity.
 * Checks for valid PDF header bytes.
 *
 * @param {Buffer|Uint8Array} buffer - Raw PDF file bytes
 * @returns {{ valid: boolean, error: string|null }}
 */
function verifyPdfIntegrity(buffer) {
  if (!buffer || buffer.length < 10) {
    return { valid: false, error: 'Buffer is empty or too small' };
  }

  // Check PDF header magic bytes: %PDF-
  const header = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3], buffer[4]);
  if (!header.startsWith('%PDF-')) {
    return { valid: false, error: 'Invalid PDF header: missing %PDF- magic bytes' };
  }

  // Extract version
  let versionEnd = 5;
  while (versionEnd < Math.min(20, buffer.length) && buffer[versionEnd] !== 0x0A && buffer[versionEnd] !== 0x0D) {
    versionEnd++;
  }
  const version = String.fromCharCode(...buffer.slice(5, versionEnd));

  // Check for minimum file size (a valid single-page PDF is at least ~500 bytes)
  if (buffer.length < 200) {
    return { valid: false, error: 'PDF file too small to be valid' };
  }

  return { valid: true, error: null, version: version.trim() };
}

/**
 * Detect the type of a PDF buffer with comprehensive validation.
 *
 * @param {Buffer|Uint8Array} buffer - Raw PDF file bytes
 * @returns {Promise<{
 *   valid: boolean,
 *   pdfType: 'text' | 'legacy_font' | 'scanned' | 'unknown',
 *   encoding: 'unicode' | 'sutonny' | 'bijoy' | 'unknown',
 *   textLayerDetected: boolean,
 *   imageBased: boolean,
 *   pageCount: number,
 *   pagesWithText: number,
 *   pagesImageOnly: number,
 *   pagesCorrupted: number,
 *   encrypted: boolean,
 *   fontNames: string[],
 *   sampleText: string,
 *   confidence: number,
 *   errors: string[],
 *   warnings: string[],
 *   pdfVersion: string,
 * }>}
 */
async function validateAndDetectPdf(buffer) {
  const errors = [];
  const warnings = [];

  // Step 1: Integrity check
  const integrity = verifyPdfIntegrity(buffer);
  if (!integrity.valid) {
    return {
      valid: false,
      pdfType: 'unknown',
      encoding: 'unknown',
      textLayerDetected: false,
      imageBased: false,
      pageCount: 0,
      pagesWithText: 0,
      pagesImageOnly: 0,
      pagesCorrupted: 0,
      encrypted: false,
      fontNames: [],
      sampleText: '',
      confidence: 0,
      errors: [integrity.error],
      warnings: [],
      pdfVersion: '',
    };
  }

  // Step 2: Load PDF with pdfjs
  const uint8 = new Uint8Array(buffer.buffer || buffer, buffer.byteOffset || 0, buffer.length || buffer.byteLength);

  let pdf;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useSystemFonts: false,
      standardFontDataUrl: null,
    });
    pdf = await loadingTask.promise;
  } catch (err) {
    // Check for encryption
    if (err.message && (err.message.includes('password') || err.message.includes('encrypted'))) {
      return {
        valid: false,
        pdfType: 'unknown',
        encoding: 'unknown',
        textLayerDetected: false,
        imageBased: false,
        pageCount: 0,
        pagesWithText: 0,
        pagesImageOnly: 0,
        pagesCorrupted: 0,
        encrypted: true,
        fontNames: [],
        sampleText: '',
        confidence: 0,
        errors: ['PDF is encrypted or password-protected'],
        warnings: [],
        pdfVersion: integrity.version || '',
      };
    }
    return {
      valid: false,
      pdfType: 'unknown',
      encoding: 'unknown',
      textLayerDetected: false,
      imageBased: false,
      pageCount: 0,
      pagesWithText: 0,
      pagesImageOnly: 0,
      pagesCorrupted: 0,
      encrypted: false,
      fontNames: [],
      sampleText: '',
      confidence: 0,
      errors: [`PDF load failed: ${err.message}`],
      warnings: [],
      pdfVersion: integrity.version || '',
    };
  }

  const totalPages = pdf.numPages;
  const pagesToSample = Math.min(5, totalPages);

  let totalChars = 0;
  let bengaliChars = 0;
  let latinExtChars = 0;
  let controlRangeChars = 0;
  let sampleText = '';
  const fontNamesFound = new Set();
  let pagesWithText = 0;
  let pagesImageOnly = 0;
  let pagesCorrupted = 0;

  for (let pageNum = 1; pageNum <= pagesToSample; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      let pageChars = 0;

      for (const item of textContent.items) {
        if (!item.str) continue;
        sampleText += item.str;
        totalChars += item.str.length;
        pageChars += item.str.length;

        for (const ch of item.str) {
          const cp = ch.codePointAt(0);
          if (cp >= 0x0980 && cp <= 0x09FF) bengaliChars++;
          if (cp >= 0x00C0 && cp <= 0x024F) latinExtChars++;
          if (cp >= 0x0080 && cp <= 0x00BF) controlRangeChars++;
        }

        if (item.fontName) {
          fontNamesFound.add(item.fontName);
        }
      }

      if (pageChars > 10) {
        pagesWithText++;
      } else {
        // Check if page has images (could be scanned)
        try {
          const ops = await page.getOperatorList();
          let hasImages = false;
          for (const op of ops.fnArray) {
            if (op === pdfjsLib.OPS.paintImageXObject || op === pdfjsLib.OPS.paintJpegXObject) {
              hasImages = true;
              break;
            }
          }
          if (hasImages && pageChars <= 10) {
            pagesImageOnly++;
          }
        } catch {
          // Ignore operator list errors
        }
      }

      page.cleanup();
    } catch (err) {
      pagesCorrupted++;
      warnings.push(`Page ${pageNum} is corrupted: ${err.message}`);
    }
  }

  await pdf.destroy();

  // Step 3: Classification logic
  const charsPerPage = pagesWithText > 0 ? totalChars / pagesWithText : 0;
  const ratio = totalChars > 0 ? legacyRatio(sampleText) : 0;
  const bengaliDensity = totalChars > 0 ? bengaliChars / totalChars : 0;
  const controlDensity = totalChars > 0 ? controlRangeChars / totalChars : 0;

  // Check font names
  const fontNameList = [...fontNamesFound].map(n => n.toLowerCase());

  const isKnownLegacyFont = fontNameList.some(n =>
    LEGACY_FONT_KEYWORDS.some(kw => n.includes(kw))
  );

  const isKnownUnicodeFont = fontNameList.some(n =>
    UNICODE_FONT_KEYWORDS.some(kw => n.includes(kw))
  );

  let pdfType, encoding, confidence;

  // Scanned PDF detection
  if (charsPerPage < 30 && pagesWithText < 2) {
    pdfType = 'scanned';
    encoding = 'unknown';
    confidence = 0.9;
    warnings.push('Very low text yield — PDF appears to be scanned/image-based');
  }
  // Font-name based detection (highest confidence)
  else if (isKnownLegacyFont && !isKnownUnicodeFont) {
    pdfType = 'legacy_font';
    encoding = fontNameList.some(n => n.includes('bijoy')) ? 'bijoy' : 'sutonny';
    confidence = 0.98;
  }
  else if (isKnownUnicodeFont && !isKnownLegacyFont) {
    pdfType = 'text';
    encoding = 'unicode';
    confidence = 0.95;
  }
  // Character-analysis based detection
  else if (ratio > 0.03 || controlDensity > 0.02) {
    pdfType = 'legacy_font';
    encoding = 'sutonny';
    confidence = Math.min(0.95, 0.5 + ratio * 3 + controlDensity * 5);
  }
  else if (bengaliDensity > 0.3) {
    pdfType = 'text';
    encoding = 'unicode';
    confidence = 0.85;
  }
  else if (bengaliDensity > 0.1) {
    pdfType = 'text';
    encoding = 'unicode';
    confidence = 0.7;
  }
  else {
    pdfType = 'legacy_font';
    encoding = 'sutonny';
    confidence = 0.6;
    warnings.push('Low confidence in encoding detection — defaulting to sutonny');
  }

  // Validate results
  if (pagesCorrupted > 0) {
    warnings.push(`${pagesCorrupted} page(s) could not be read`);
  }
  if (pagesImageOnly > 0 && pdfType !== 'scanned') {
    warnings.push(`${pagesImageOnly} page(s) appear to be image-only (may need OCR)`);
  }

  return {
    valid: errors.length === 0,
    pdfType,
    encoding,
    textLayerDetected: pagesWithText > 0,
    imageBased: pagesImageOnly >= pagesWithText,
    pageCount: totalPages,
    pagesWithText,
    pagesImageOnly,
    pagesCorrupted,
    encrypted: false,
    fontNames: [...fontNamesFound],
    sampleText: sampleText.substring(0, 300),
    confidence,
    errors,
    warnings,
    pdfVersion: integrity.version || '',
  };
}

// Backward compatibility: export as detectPdfType too
async function detectPdfType(buffer) {
  const result = await validateAndDetectPdf(buffer);
  return {
    type: result.pdfType,
    encoding: result.encoding,
    fontNames: result.fontNames,
    sampleText: result.sampleText,
    totalPages: result.pageCount,
    confidence: result.confidence,
  };
}

module.exports = {
  validateAndDetectPdf,
  detectPdfType,
  verifyPdfIntegrity,
};
