'use strict';

/**
 * Production PDF Parser Service
 *
 * Replaces the old pdf-parse based service with a pdfjs-dist pipeline
 * that correctly handles:
 *   • Unicode Bengali PDFs (standard, no conversion needed)
 *   • Legacy-font PDFs (SutonnyMJ / Bijoy — glyph map + pre-matra reorder)
 *   • Scanned PDFs (basic detection; OCR via tesseract.js if installed)
 *
 * Architecture:
 *   buffer → detectPdfType → extractTextWithPdfjs → convertToUnicode
 *          → extractCoverPageData → extractVoters → return structured data
 */

const { v4: uuidv4 } = require('uuid');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const { detectPdfType } = require('../utils/pdfTypeDetector');
const { autoConvert, normalizeForSearch, legacyRatio } = require('../utils/bengaliUnicodeConverter');

// ── Constants ────────────────────────────────────────────────────────────────

const VOTERS_PER_PAGE = 15; // typical EC voter list layout

// ── Text extraction with pdfjs-dist ─────────────────────────────────────────

/**
 * Extract all text from a PDF using pdfjs-dist.
 * Returns pages as arrays of text items with spatial coordinates.
 *
 * @param {Buffer|Uint8Array} buffer
 * @param {object} opts
 * @param {number}  opts.maxPages      - 0 = all pages
 * @param {boolean} opts.groupByLine   - reassemble items into line strings
 * @returns {Promise<{ pages: Array<{pageNum, lines: string[], items: object[]}>, totalPages: number }>}
 */
async function extractRawPages(buffer, { maxPages = 0, groupByLine = true } = {}) {
  // Ensure it's a pure Uint8Array to satisfy pdfjs strict type checking
  const uint8 = new Uint8Array(buffer.buffer || buffer, buffer.byteOffset || 0, buffer.length || buffer.byteLength);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: false,
    standardFontDataUrl: null,
    // Disable CMap fetching (we handle encoding ourselves)
    cMapUrl: null,
    cMapPacked: false,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const limit = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages;

  const pages = [];

  // Process pages in chunks of 20 to avoid OOM on large voter PDFs
  const CHUNK = 20;
  for (let start = 1; start <= limit; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, limit);

    for (let pageNum = start; pageNum <= end; pageNum++) {
      if (pageNum === 2) {
        // Skip page 2 completely to save memory and avoid garbage data
        pages.push({ pageNum, lines: [], items: [] });
        continue;
      }
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent({ normalizeWhitespace: false });

      const rawItems = textContent.items
        .filter(item => item.str && item.str.length > 0)
        .map(item => ({
          str: item.str,
          x: item.transform ? item.transform[4] : 0,
          y: item.transform ? item.transform[5] : 0,
          width: item.width || 0,
          height: item.height || 0,
          fontName: item.fontName || '',
          hasEOL: item.hasEOL || false,
        }));

      let lines = [];
      if (groupByLine && rawItems.length > 0) {
        // Partition items into columns to prevent merging voters horizontally.
        // Use X-coordinate clustering to find column boundaries dynamically.
        const columns = clusterIntoColumns(rawItems);
        
        // Process each column independently
        for (const colItems of columns) {
          const colLines = groupItemsIntoLines(colItems, 4, pageNum);
          lines.push(...colLines);
        }
      }

      pages.push({ pageNum, lines, items: rawItems });
      page.cleanup();
    }
  }

  await pdf.destroy();
  return { pages, totalPages };
}

/**
 * Cluster text items into columns using X-coordinate gaps.
 * EC voter lists have 3 columns with clear vertical separators.
 *
 * @param {object[]} items - Text items with x coordinates
 * @returns {object[][]} Array of columns, each containing items
 */
function clusterIntoColumns(items) {
  if (items.length === 0) return [];

  // Find the X-coordinate range
  const xValues = items.map(i => i.x).sort((a, b) => a - b);
  const minX = xValues[0];
  const maxX = xValues[xValues.length - 1];
  const range = maxX - minX;

  if (range < 150) {
    // All items in a narrow range — single column (cover page, etc.)
    return [items];
  }

  // Filter items with width < range * 0.4 to ignore title spans
  const colItems = items.filter(i => (i.width || 0) < range * 0.4);

  // Default splits
  let col1Boundary = minX + range * 0.33;
  let col2Boundary = minX + range * 0.66;

  // Let's find S1 in [minX + range * 0.20, minX + range * 0.45]
  const low1 = minX + range * 0.20;
  const high1 = minX + range * 0.45;
  const xList1 = colItems.map(i => i.x).filter(x => x >= low1 && x <= high1).sort((a, b) => a - b);
  if (xList1.length >= 2) {
    let maxGap = -1;
    let bestSplit = col1Boundary;
    for (let i = 0; i < xList1.length - 1; i++) {
      const gap = xList1[i+1] - xList1[i];
      if (gap > maxGap) {
        maxGap = gap;
        bestSplit = (xList1[i] + xList1[i+1]) / 2;
      }
    }
    col1Boundary = bestSplit;
  }

  // Let's find S2 in [minX + range * 0.55, minX + range * 0.80]
  const low2 = minX + range * 0.55;
  const high2 = minX + range * 0.80;
  const xList2 = colItems.map(i => i.x).filter(x => x >= low2 && x <= high2).sort((a, b) => a - b);
  if (xList2.length >= 2) {
    let maxGap = -1;
    let bestSplit = col2Boundary;
    for (let i = 0; i < xList2.length - 1; i++) {
      const gap = xList2[i+1] - xList2[i];
      if (gap > maxGap) {
        maxGap = gap;
        bestSplit = (xList2[i] + xList2[i+1]) / 2;
      }
    }
    col2Boundary = bestSplit;
  }

  const col1 = [];
  const col2 = [];
  const col3 = [];

  for (const item of items) {
    if (item.x < col1Boundary) col1.push(item);
    else if (item.x < col2Boundary) col2.push(item);
    else col3.push(item);
  }

  return [col1, col2, col3].filter(c => c.length > 0);
}

/**
 * Group text items into logical lines by y-coordinate proximity.
 * Sorts items left-to-right within each line.
 *
 * @param {object[]} items
 * @param {number}   tolerance - y-distance threshold to consider same line
 * @returns {string[]} Array of line strings
 */
function groupItemsIntoLines(items, tolerance = 4, pageNum = 1) {
  if (!items.length) return [];

  // Sort by y descending (PDF y=0 is bottom), then x ascending
  const sorted = [...items].sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > tolerance) return dy;
    return a.x - b.x;
  });

  const lineGroups = [];
  let currentGroup = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= tolerance) {
      currentGroup.push(item);
    } else {
      lineGroups.push(currentGroup);
      currentGroup = [item];
      currentY = item.y;
    }
  }
  lineGroups.push(currentGroup);

  return lineGroups.map(group => {
    const sortedGroup = group.sort((a, b) => a.x - b.x);
    const text = sortedGroup
      .map(item => item.str)
      .join(' ')
      .replace(/\s{3,}/g, '\t') // collapse big gaps (column separators) to tab
      .trim();

    // Compute bounding box coordinates for the entire line
    const minX = Math.min(...sortedGroup.map(item => item.x));
    const maxX = Math.max(...sortedGroup.map(item => item.x + (item.width || 0)));
    const minY = Math.min(...sortedGroup.map(item => item.y));
    const maxY = Math.max(...sortedGroup.map(item => item.y + (item.height || 0)));

    return {
      text,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      pageNum,
    };
  });
}

/**
 * Convert all extracted page lines to Unicode Bengali.
 *
 * @param {object[]} pages     - Output from extractRawPages
 * @param {string}   encoding  - 'sutonny' | 'bijoy' | 'unicode'
 * @returns {object[]} pages with converted lines
 */
function convertPages(pages, encoding) {
  return pages.map(page => ({
    ...page,
    lines: page.lines.map(lineObj => {
      const { text } = autoConvert(lineObj.text, encoding);
      return {
        ...lineObj,
        text,
      };
    }),
  }));
}

// ── Cover page metadata extraction ──────────────────────────────────────────

/**
 * Parse Bengali/English numbers (handles ০-৯ and 0-9 and commas)
 */
function parseBengaliNumber(str) {
  if (!str) return 0;
  const map = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
  return parseInt(str.replace(/[,\s]/g, '').split('').map(c => map[c] || c).join('')) || 0;
}

/**
 * Extract cover page metadata from full converted text.
 */
function extractCoverPageData(text) {
  const meta = {
    district: '',
    upazila: '',
    unionName: '',
    wardNo: '',
    voterArea: '',
    voterAreaNo: '',
    totalVoters: 0,
    totalMaleVoters: 0,
    totalFemaleVoters: 0,
    genderType: 'পুরুষ',
    publicationDate: '',
    postCode: '',
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if ((line.includes('জেলা') || line.includes('জেলা:'))) {
      const m = line.match(/জেলা[:\s।]+(.+)/u);
      if (m && !meta.district) meta.district = m[1].trim().replace(/[\u0964\u0965]/g, '').split(/\s{2,}/)[0].trim();
    }
    if (line.includes('উপজেলা') || line.includes('থানা')) {
      const m = line.match(/(?:উপজেলা|থানা)[/\s]*(?:থানা)?[:\s।]+(.+)/u);
      if (m && !meta.upazila) meta.upazila = m[1].trim().split(/\s{2,}/)[0].trim();
    }
    if (line.includes('ইউনিয়ন') || line.includes('ওয়ার্ড/কাঃ বোঃ')) {
      const m = line.match(/(?:ইউনিয়ন|ওয়ার্ড)[^:]*[:\s।]+(.+)/u);
      if (m && !meta.unionName) meta.unionName = m[1].trim().split(/\s{2,}/)[0].trim();
    }
    if (line.includes('ওয়ার্ড নম্বর') || line.includes('ওয়ার্ড নং')) {
      const m = line.match(/ওয়ার্ড\s*(?:নম্বর|নং)[^:]*[:\s।]+([০-৯\d]+)/u);
      if (m) meta.wardNo = m[1].trim();
    }
    if (line.includes('ভোটার এলাকার নম্বর') || line.includes('ভোটার এলাকা নম্বর') || line.includes('ভোটার এলাকার কোড')) {
      const m = line.match(/ভোটার এলাকা(?:র)?\s*(?:নম্বর|কোড)[:\s।]+([০-৯\d]+)/u);
      if (m) meta.voterAreaNo = m[1].trim();
    }
    if (line.includes('ভোটার এলাকা') && !line.includes('নম্বর') && !line.includes('কোড')) {
      const m = line.match(/ভোটার এলাকা(?:র নাম)?[:\s।]*(.+)/u);
      if (m && !meta.voterArea) meta.voterArea = m[1].trim().split(/\s{2,}/)[0].trim();
    }
    if (line.includes('সর্বমোট ভোটার') || line.includes('সবমোট ভোটার')) {
      const m = line.match(/(?:সর্ব|সব)মোট ভোটার[^:]*[:\s।]+([০-৯\d,]+)/u);
      if (m) meta.totalVoters = parseBengaliNumber(m[1]);
    }
    if (line.includes('মোট পুরুষ')) {
      const m = line.match(/মোট পুরুষ[^:]*[:\s।]+([০-৯\d,]+)/u);
      if (m) { meta.totalMaleVoters = parseBengaliNumber(m[1]); meta.genderType = 'পুরুষ'; }
    }
    if (line.includes('মোট মহিলা')) {
      const m = line.match(/মোট মহিলা[^:]*[:\s।]+([০-৯\d,]+)/u);
      if (m) { meta.totalFemaleVoters = parseBengaliNumber(m[1]); meta.genderType = 'মহিলা'; }
    }
    if (line.includes('তালিকা') && (line.includes('পুরুষ') || line.includes('মহিলা'))) {
      if (line.includes('মহিলা')) meta.genderType = 'মহিলা';
      else if (line.includes('পুরুষ')) meta.genderType = 'পুরুষ';
    }
    if (line.includes('প্রকাশের তারিখ') || line.includes('প্রকাশ তারিখ') || line.includes('প্রকাশের তারিখ')) {
      const m = line.match(/(?:প্রকাশ(?:ের)? তারিখ)[:\s।]+([০-৯\d/]+)/u);
      if (m) meta.publicationDate = m[1].trim();
    }
    if (line.includes('পোস্টকোড') || line.includes('পোষ্টকোড')) {
      const m = line.match(/পো(?:স্ট|ষ্ট)কোড[:\s।]+([০-৯\d]+)/u);
      if (m) meta.postCode = m[1].trim();
    }
    if ((line.includes('ডাকঘর') || line.includes('ডাকঃ')) && !meta.voterArea) {
      const m = line.match(/ডাক(?:ঘর)?[:\s।]*(.+)/u);
      if (m) meta.voterArea = m[1].trim().split(/\s{2,}/)[0].trim();
    }
  }

  return meta;
}

// ── Voter record extraction ──────────────────────────────────────────────────

/**
 * Clean up common name prefixes and zero-width spaces/punctuation artifacts.
 */
function cleanNamePrefix(name) {
  if (!name) return '';
  return name
    .replace(/^[\s\u200B-\u200D\uFEFF]+/u, '') // strip invisible spaces
    .replace(/^(নাম|নাঃ|নাস|নামের|নামঃ)[\s:।\-._]*/u, '') // remove "নাম:" or "নাঃ" etc.
    .replace(/^[\s:।\-._]+/u, '') // strip remaining punctuation/spaces
    .trim();
}

/**
 * Parse all voter entries from converted text lines.
 * Handles the standard 3-column Bangladesh EC voter list format.
 *
 * Each voter block structure:
 *   ০০১. নাম: শেখ মোহাম্মদ আলী
 *   ভোটার নং: ১২৩৪৫৬
 *   পিতা: মোহাম্মদ হাসান
 *   মাতা: ফাতেমা বেগম
 *   পেশা: কৃষক    জন্ম তারিখ: ০১/০১/১৯৮০
 *   ঠিকানা: গ্রাম নাম
 */
function extractVoters(allLineObjs, coverMeta, pdfId) {
  const voters = [];
  let lastSerialNum = 0;
  let i = 0;

  while (i < allLineObjs.length) {
    const lineObj = allLineObjs[i];
    const line = lineObj.text;

    // Match voter entry: Bengali or English 2-4 digit serial followed by dot
    // e.g. " ০০১." or "001. নাম:" or "০০১. শেখ ওবায়েদ"
    const serialMatch = line.match(/^\s*([০-৯\d]{2,4})\.[\s।]*(?:নাম\s*[:।]\s*)?(.+)/u);

    if (serialMatch) {
      const serialStr = serialMatch[1];
      const serialNum = parseBengaliNumber(serialStr);

      // Guard against false positives
      if (serialNum > 0) {
        lastSerialNum = serialNum;

        // Clean up name: remove "নাম " prefix and other artifacts
        let nameBn = cleanNamePrefix(serialMatch[2]);

        let voterNo = '';
        let fatherName = '';
        let motherName = '';
        let occupation = '';
        let dob = '';
        let address = '';

        // Read up to 12 lines after serial line for this voter's fields
        let j = i + 1;
        let linesRead = 0;

        while (j < allLineObjs.length && linesRead < 12) {
          const next = allLineObjs[j].text.trim();

          // Stop at next voter entry (allow optional spaces, Bengali or English digits)
          if (next.match(/^\s*[০-৯\d]{2,4}\.[\s।]/u)) break;

          // Voter number
          if (/(?:ভোটার|ভাটার)\s*(?:নং|নম্বর)/u.test(next)) {
            const m = next.match(/(?:ভোটার|ভাটার)\s*(?:নং|নম্বর)\s*[:।]*\s*([০-৯\d]+)/u);
            if (m) voterNo = m[1].trim();
          }
          // Father
          else if (/পিতা/u.test(next) && !next.includes('মাতা')) {
            const m = next.match(/পিতা\s*[:।]*\s*(.+)/u);
            if (m) fatherName = m[1].replace(/মাতা.*/u, '').replace(/পেশা.*/u, '').trim();
          }
          // Mother
          else if (/মাতা/u.test(next)) {
            const m = next.match(/মাতা\s*[:।]*\s*(.+)/u);
            if (m) motherName = m[1].replace(/পেশা.*/u, '').trim();
          }
          // Occupation (may include DOB on same line)
          else if (/পেশা/u.test(next)) {
            // Check if there is a date in the line
            const dateMatch = next.match(/([০-৯\d]{1,2}\/[০-৯\d]{1,2}\/[০-৯\d]{4})/u);
            if (dateMatch) {
              dob = dateMatch[1];
              // The occupation is everything before the date, but we need to strip "পেশা:", "জন্ম", "তারিখ" etc.
              const beforeDate = next.split(dob)[0];
              occupation = beforeDate
                .replace(/পেশা\s*[:।,]*\s*/u, '')
                .replace(/(?:জন্ম|তারিখ|তািরখ|জহ্ল|জিহ্ম|তাং)[\s:,।]*/gu, '')
                .replace(/[,।]+$/, '')
                .trim();
            } else {
              const m = next.match(/পেশা\s*[:।,]*\s*(.+)/u);
              if (m) occupation = m[1].trim();
            }
          }
          // DOB standalone
          else if (/জন্ম\s*তারিখ/u.test(next)) {
            const m = next.match(/([০-৯\d]{1,2}\/[০-৯\d]{1,2}\/[০-৯\d]{4})/u);
            if (m) dob = m[1];
          }
          // Address
          else if (/ঠিকানা\s*[:।]/u.test(next)) {
            const m = next.match(/ঠিকানা\s*[:।]\s*(.+)/u);
            if (m) address = m[1].trim();
          }
          // Continuation of name (some PDFs wrap name to next line)
          else if (!voterNo && !fatherName && nameBn.length < 40 && /^[\u0980-\u09FF\s]+$/.test(next)) {
            nameBn += ' ' + next;
          }

          j++;
          linesRead++;
        }

        // Final name prefix/space cleanup
        nameBn = cleanNamePrefix(nameBn);

        // Require at least one critical field populated to prevent header/footer noise false positives
        if (nameBn && nameBn.length > 1 && (voterNo || fatherName || motherName)) {
          const pdfPageNumber = lineObj.pageNum;
          const serialOnPage = ((serialNum - 1) % VOTERS_PER_PAGE) + 1;

          voters.push({
            id: uuidv4(),
            serialNo: serialStr,
            serialNum,
            serialOnPage,
            nameBn: nameBn.substring(0, 80),
            nameEn: '',
            voterNo: voterNo || '',
            nid: '',
            fatherName: (fatherName || '').substring(0, 80),
            motherName: (motherName || '').substring(0, 80),
            occupation: (occupation || '').substring(0, 50),
            dob: dob || '',
            gender: coverMeta.genderType === 'মহিলা' ? 'মহিলা' : 'পুরুষ',
            village: coverMeta.voterArea || '',
            voterArea: coverMeta.voterArea || '',
            voterAreaNo: coverMeta.voterAreaNo || '',
            unionName: coverMeta.unionName || '',
            wardNo: coverMeta.wardNo || '',
            upazila: coverMeta.upazila || '',
            district: coverMeta.district || '',
            postCode: coverMeta.postCode || '',
            publicationDate: coverMeta.publicationDate || '',
            address: address || [coverMeta.voterArea, coverMeta.upazila, coverMeta.district].filter(Boolean).join(', '),
            status: 'সক্রিয়',
            pdfUploadId: pdfId,
            pdfPageNumber,
            boundingBox: {
              x: lineObj.x,
              y: lineObj.y,
              width: lineObj.width,
              height: lineObj.height,
            },
          });
        }

        i = j;
        continue;
      }
    }

    i++;
  }

  return voters;
}

// ── OCR Fallback (for scanned PDFs) ─────────────────────────────────────────

/**
 * Attempt OCR on a scanned PDF.
 * Requires 'tesseract.js' to be installed separately.
 * Returns empty result with a warning if tesseract.js is not found.
 */
async function ocrFallback(buffer, pdfId, fileName) {
  try {
    // Dynamic import so the service works even without tesseract.js
    const Tesseract = require('tesseract.js');
    const { createWorker } = Tesseract;

    console.warn('[PDF Parser] Scanned PDF detected — attempting OCR (slow)...');

    // For scanned PDFs we'd need to rasterize pages first (requires canvas)
    // Basic implementation: extract any embedded text that might exist
    console.warn('[PDF Parser] OCR for scanned PDFs requires additional setup.');
    console.warn('[PDF Parser] Install: npm install tesseract.js canvas pdfjs-dist');

    return {
      coverMeta: { district: '', upazila: '', unionName: '', wardNo: '', voterArea: '', voterAreaNo: '', totalVoters: 0, totalMaleVoters: 0, totalFemaleVoters: 0, genderType: 'পুরুষ', publicationDate: '', postCode: '' },
      voters: [],
      totalPages: 0,
      rawTextLength: 0,
      pdfType: 'scanned',
      encoding: 'unknown',
      warning: 'Scanned PDF detected. Install tesseract.js for OCR support.',
    };
  } catch (_) {
    return {
      coverMeta: { district: '', upazila: '', unionName: '', wardNo: '', voterArea: '', voterAreaNo: '', totalVoters: 0, totalMaleVoters: 0, totalFemaleVoters: 0, genderType: 'পুরুষ', publicationDate: '', postCode: '' },
      voters: [],
      totalPages: 0,
      rawTextLength: 0,
      pdfType: 'scanned',
      encoding: 'unknown',
      warning: 'Scanned PDF detected. OCR not available (tesseract.js not installed).',
    };
  }
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Parse a voter list PDF buffer and return structured data.
 *
 * @param {Buffer}  buffer   - Raw PDF file bytes from multer
 * @param {string}  pdfId    - UUID for this upload
 * @param {string}  fileName - Original file name (for logging)
 * @returns {Promise<{
 *   coverMeta: object,
 *   voters: object[],
 *   totalPages: number,
 *   rawTextLength: number,
 *   pdfType: string,
 *   encoding: string,
 *   confidence: number,
 *   warning?: string,
 * }>}
 */
async function parsePdfBuffer(buffer, pdfId, fileName) {
  console.log(`\n[PDF Parser] ─────────────────────────────────────────────`);
  console.log(`[PDF Parser] File: ${fileName}`);

  // ── Step 1: Detect PDF type ──────────────────────────────────────────────
  let detection;
  try {
    detection = await detectPdfType(buffer);
  } catch (err) {
    console.warn('[PDF Parser] Type detection failed, assuming legacy_font:', err.message);
    detection = { type: 'legacy_font', encoding: 'sutonny', totalPages: 0, confidence: 0.5, fontNames: [] };
  }

  console.log(`[PDF Parser] Type     : ${detection.type} (confidence: ${(detection.confidence * 100).toFixed(0)}%)`);
  console.log(`[PDF Parser] Encoding : ${detection.encoding}`);
  console.log(`[PDF Parser] Pages    : ${detection.totalPages}`);
  if (detection.fontNames.length > 0) {
    console.log(`[PDF Parser] Fonts    : ${detection.fontNames.slice(0, 5).join(', ')}`);
  }

  // ── Step 2: Route to correct strategy ───────────────────────────────────
  if (detection.type === 'scanned') {
    return ocrFallback(buffer, pdfId, fileName);
  }

  // ── Step 3: Extract raw text using pdfjs-dist (spatial layout aware) ────
  let rawPages;
  try {
    rawPages = await extractRawPages(buffer, { maxPages: 0, groupByLine: true });
  } catch (err) {
    throw new Error(`PDF text extraction failed: ${err.message}`);
  }

  // ── Step 4: Convert to Unicode Bengali ──────────────────────────────────
  const convertedPages = detection.type === 'legacy_font'
    ? convertPages(rawPages.pages, detection.encoding)
    : rawPages.pages; // already Unicode

  // ── Step 5: Build full text (mapping line objects to text for logging/compatibility) ──
  const fullText = convertedPages
    .map(p => p.lines.map(l => l.text).join('\n'))
    .join('\n');

  // Diagnostic: sample of first 300 chars after conversion
  console.log(`[PDF Parser] Sample   : ${fullText.substring(0, 300).replace(/\n/g, ' ')}`);

  // ── Step 6: Extract cover page metadata from Page 1 only ─────────────────
  const page1 = convertedPages.find(p => p.pageNum === 1);
  const page1Text = page1 ? page1.lines.map(l => l.text).join('\n') : '';
  const coverMeta = extractCoverPageData(page1Text);
  console.log(`[PDF Parser] District : ${coverMeta.district || '(not found)'}`);
  console.log(`[PDF Parser] Upazila  : ${coverMeta.upazila || '(not found)'}`);

  // ── Step 7: Extract voter records strictly from Page 3 onwards ──────────
  const voterPages = convertedPages.filter(p => p.pageNum >= 3);
  const voterLineObjects = [];
  for (const page of voterPages) {
    voterLineObjects.push(...page.lines);
  }
  const voters = extractVoters(voterLineObjects, coverMeta, pdfId);
  console.log(`[PDF Parser] Voters   : ${voters.length} extracted`);
  console.log(`[PDF Parser] ─────────────────────────────────────────────\n`);

  return {
    coverMeta,
    voters,
    totalPages: rawPages.totalPages,
    rawTextLength: fullText.length,
    pdfType: detection.type,
    encoding: detection.encoding,
    confidence: detection.confidence,
  };
}

module.exports = { parsePdfBuffer, parseBengaliNumber, extractCoverPageData };
