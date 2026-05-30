'use strict';

/**
 * PDF Type Detector
 *
 * Automatically classifies a PDF into one of three types:
 *
 *  • 'text'         — Has embedded text with standard Unicode (searchable, correct)
 *  • 'legacy_font'  — Has embedded text with legacy Bengali font encoding (SutonnyMJ/Bijoy)
 *  • 'scanned'      — Image-only PDF with no embedded text (needs OCR)
 *
 * Detection strategy (in order):
 *  1. Extract text from first 3 pages using pdfjs-dist
 *  2. Count Bengali Unicode chars vs Latin Extended chars
 *  3. If text yield is too low → scanned
 *  4. If text has Latin Extended mixed with Bengali → legacy_font
 *  5. Else → text (already Unicode)
 *
 * Also tries to read embedded font names to confirm encoding type.
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const { legacyRatio } = require('./bengaliUnicodeConverter');

const BENGALI_RE = /[\u0980-\u09FF]/;

// Known Unicode Bengali fonts — these do NOT need conversion
const UNICODE_FONT_KEYWORDS = [
  'unicode', 'noto', 'solaimanlipi', 'bangla', 'vrinda',
  'nikosh', 'kalpurush', 'siyam', 'adarshalipi', 'banglatype',
  'shonarBangla', 'lohit', 'freesans', 'freeserif',
];

// Known legacy fonts — these DO need conversion
const LEGACY_FONT_KEYWORDS = [
  'sutonny', 'bijoy', 'akaash', 'muktinarrow',
];

/**
 * Detect the type of a PDF buffer.
 *
 * @param {Buffer|Uint8Array} buffer - Raw PDF file bytes
 * @returns {Promise<{
 *   type: 'text' | 'legacy_font' | 'scanned',
 *   encoding: 'unicode' | 'sutonny' | 'bijoy' | 'unknown',
 *   fontNames: string[],
 *   sampleText: string,
 *   confidence: number,
 *   totalPages: number,
 * }>}
 */
async function detectPdfType(buffer) {
  // Ensure it's a pure Uint8Array to satisfy pdfjs strict type checking
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
    throw new Error(`PDF load failed in type detector: ${err.message}`);
  }

  const totalPages = pdf.numPages;
  // Sample more pages — EC PDFs often have a blank page 2
  const pagesToSample = Math.min(5, totalPages);

  let totalChars = 0;
  let bengaliChars = 0;
  let latinExtChars = 0;
  let controlRangeChars = 0; // U+0080-U+00BF — used by EC fonts
  let sampleText = '';
  const fontNamesFound = new Set();
  let pagesWithText = 0;

  for (let pageNum = 1; pageNum <= pagesToSample; pageNum++) {
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

      // Try to collect font name from page common objects
      if (item.fontName) {
        fontNamesFound.add(item.fontName);
      }
    }

    if (pageChars > 10) pagesWithText++;
    page.cleanup();
  }

  await pdf.destroy();

  // ── Decision logic ────────────────────────────────────────────────────────

  const charsPerPage = pagesWithText > 0 ? totalChars / pagesWithText : 0;
  const ratio = totalChars > 0 ? legacyRatio(sampleText) : 0;
  const bengaliDensity = totalChars > 0 ? bengaliChars / totalChars : 0;
  const controlDensity = totalChars > 0 ? controlRangeChars / totalChars : 0;

  // Very low text yield → scanned PDF
  if (charsPerPage < 30 && pagesWithText < 2) {
    return {
      type: 'scanned',
      encoding: 'unknown',
      fontNames: [...fontNamesFound],
      sampleText: sampleText.substring(0, 200),
      totalPages,
      confidence: 0.9,
    };
  }

  // Check font names for known legacy fonts
  const fontNameList = [...fontNamesFound].map(n => n.toLowerCase());

  const isKnownLegacyFont = fontNameList.some(n =>
    LEGACY_FONT_KEYWORDS.some(kw => n.includes(kw))
  );

  const isKnownUnicodeFont = fontNameList.some(n =>
    UNICODE_FONT_KEYWORDS.some(kw => n.includes(kw))
  );

  let type, encoding, confidence;

  if (isKnownLegacyFont && !isKnownUnicodeFont) {
    type = 'legacy_font';
    encoding = fontNameList.some(n => n.includes('bijoy')) ? 'bijoy' : 'sutonny';
    confidence = 0.98;
  } else if (isKnownUnicodeFont && !isKnownLegacyFont) {
    type = 'text';
    encoding = 'unicode';
    confidence = 0.95;
  } else if (ratio > 0.03 || controlDensity > 0.02) {
    // Has Latin Extended or control-range chars mixed with Bengali → legacy font
    // EC PDFs typically have Bengali consonants in Unicode range but matras/conjuncts
    // as Latin Extended — this is the SutonnyMJ pattern
    type = 'legacy_font';
    encoding = 'sutonny'; // most common EC PDF type
    confidence = Math.min(0.95, 0.5 + ratio * 3 + controlDensity * 5);
  } else if (bengaliDensity > 0.3) {
    type = 'text';
    encoding = 'unicode';
    confidence = 0.85;
  } else {
    // Default: if we have text but can't determine encoding,
    // check if Bengali chars dominate
    if (bengaliDensity > 0.1) {
      type = 'text';
      encoding = 'unicode';
      confidence = 0.7;
    } else {
      type = 'legacy_font';
      encoding = 'sutonny';
      confidence = 0.6;
    }
  }

  return {
    type,
    encoding,
    fontNames: [...fontNamesFound],
    sampleText: sampleText.substring(0, 300),
    totalPages,
    confidence,
  };
}

module.exports = { detectPdfType };
