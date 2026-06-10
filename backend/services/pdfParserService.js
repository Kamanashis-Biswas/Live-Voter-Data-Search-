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
 *          → extractCoverPageData → extractVoters → correctVoters → return structured data
 *
 * CORRECTION PIPELINE (v7.0.0):
 *   After voter extraction, every record passes through:
 *     1. Dictionary Correction — fixes corrupted Bengali words
 *     2. Name Correction — fixes corrupted person names using fuzzy/phonetic matching
 *     3. District Validation — corrects geographic field spelling
 */

const { v4: uuidv4 } = require('uuid');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const { detectPdfType } = require('../utils/pdfTypeDetector');
const { autoConvert, normalizeForSearch, legacyRatio } = require('../utils/bengaliUnicodeConverter');
const { correctText } = require('../utils/dictionaryCorrector');
const { correctName } = require('../utils/nameCorrector');
const { validateAddress } = require('../utils/districtValidator');
const logger = require('../utils/logger');

// ── Constants ────────────────────────────────────────────────────────────────

const VOTERS_PER_PAGE = 15; // typical EC voter list layout

// ── Text extraction with pdfjs-dist ─────────────────────────────────────────

/**
 * Extracts raw pages and text items with coordinates from a PDF buffer using pdfjs-dist.
 * 
 * DESIGN DECISION:
 *   - The election commission (EC) voter list contains a blank page on Page 2. Processing this page
 *     wastes CPU and memory, so it is bypassed.
 *   - Processing large PDFs causes Out-of-Memory (OOM) errors in Node.js. To prevent OOM crashes,
 *     we process pages in chunks of 20, cleaning up references after each page finishes.
 *
 * @param {Buffer|Uint8Array} buffer - The raw PDF bytes uploaded by Multer memoryStorage.
 * @param {object} [opts={}] - Extraction configuration options.
 * @param {number} [opts.maxPages=0] - Maximum pages to extract (0 extracts all pages).
 * @param {boolean} [opts.groupByLine=true] - Reassemble layout items into distinct visual lines.
 * @returns {Promise<{ pages: Array<{pageNum: number, lines: object[], items: object[]}>, totalPages: number }>}
 * @async
 */
async function extractRawPages(buffer, { maxPages = 0, groupByLine = true } = {}) {
  // Ensure the buffer is converted to a pure Uint8Array to satisfy strict pdfjs binary type checks
  const uint8 = new Uint8Array(buffer.buffer || buffer, buffer.byteOffset || 0, buffer.length || buffer.byteLength);

  // Initialize the pdfjs loading task bypassing the system fonts and standard CMaps
  // since we convert legacy Bijoy/Sutonny ASCII codepoints via our custom converter.
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: false,
    standardFontDataUrl: null,
    cMapUrl: null,
    cMapPacked: false,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const limit = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages;

  const pages = [];

  // CHUNKING PATTERN: Group pages in chunks of 20 to allow the garbage collector (GC) 
  // to free parsed PDF document objects, avoiding memory saturation on large registers.
  const CHUNK = 20;
  for (let start = 1; start <= limit; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, limit);

    for (let pageNum = start; pageNum <= end; pageNum++) {
      // MEMORY OPTIMIZATION: Page 2 of the standard Bangladesh EC voter PDF is always blank.
      // Skipping this page completely eliminates unnecessary processing cycles.
      if (pageNum === 2) {
        pages.push({ pageNum, lines: [], items: [] });
        continue;
      }
      
      const page = await pdf.getPage(pageNum);
      // Retrieve text items without normalising whitespaces to keep exact raw spacing
      const textContent = await page.getTextContent({ normalizeWhitespace: false });

      // Map raw pdfjs text spans into flat visual coordinate representations.
      // pdfjs item.transform represents the affine transformation matrix [a, b, c, d, e, f]:
      // transform[4] represents the X coordinate translation (left margin margin point)
      // transform[5] represents the Y coordinate translation (bottom margin margin point)
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
      // Reassemble individual text spans into complete lines using spatial layouts.
      if (groupByLine && rawItems.length > 0) {
        if (pageNum === 1) {
          // Cover page: DON'T use column clustering — it's a structured metadata page
          // with label-value pairs on the same row. Group by Y-coordinate to keep
          // "উপজেলা/থানা রামপাল" together on one line.
          lines = groupItemsIntoLines(rawItems, 4, pageNum);
        } else {
          // Voter pages: use column clustering for the 3-column layout
          const columns = clusterIntoColumns(rawItems);
          for (const colItems of columns) {
            const colLines = groupItemsIntoLines(colItems, 4, pageNum);
            lines.push(...colLines);
          }
        }
      }

      pages.push({ pageNum, lines, items: rawItems });
      
      // Release internal references inside the PDF.js page instance to save memory
      page.cleanup();
    }
  }

  // Terminate loading tasks and workers
  await pdf.destroy();
  return { pages, totalPages };
}

/**
 * Clusters text items into visual columns using gaps in the X-coordinate space.
 * 
 * ALGORITHM EXPLANATION:
 *   - Bangladesh Election Commission (EC) voter lists strictly utilize a 3-column layout.
 *   - If we extract text top-to-bottom across the whole page, text from Column 1, 2, and 3 merges on the same horizontal line.
 *   - To prevent horizontal merging, we dynamically detect vertical dividers using X-coordinate clusters.
 *   - First, we analyze the minimum and maximum X coordinates of all page items to find the page width range.
 *   - Next, we partition the items into 3 columns (col1, col2, col3) by locating the widest white-space horizontal gaps.
 *   - Gaps are scanned within split regions: Split 1 around 20%-45% of width, and Split 2 around 55%-80% of width.
 *
 * @param {object[]} items - Array of raw spatial text items from PDF.js.
 * @returns {object[][]} A nested array containing separated item lists representing each visual column.
 */
function clusterIntoColumns(items) {
  if (items.length === 0) return [];

  // Determine page horizontal limits
  const xValues = items.map(i => i.x).sort((a, b) => a - b);
  const minX = xValues[0];
  const maxX = xValues[xValues.length - 1];
  const range = maxX - minX;

  // Narrow range indicates cover sheet or meta pages (e.g. single-column metadata)
  if (range < 150) {
    return [items];
  }

  // Exclude title spans or long header items spanning multiple columns (> 40% of page range)
  const colItems = items.filter(i => (i.width || 0) < range * 0.4);

  // Set default fallback boundaries at 1/3 and 2/3 of the coordinate span
  let col1Boundary = minX + range * 0.33;
  let col2Boundary = minX + range * 0.66;

  // Locate the ideal visual vertical split for the first column divider in [20% to 45% of page width]
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

  // Locate the ideal visual vertical split for the second column divider in [55% to 80% of page width]
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

  // Group each character or word span into its designated column bucket
  for (const item of items) {
    if (item.x < col1Boundary) col1.push(item);
    else if (item.x < col2Boundary) col2.push(item);
    else col3.push(item);
  }

  return [col1, col2, col3].filter(c => c.length > 0);
}

/**
 * Groups raw horizontal text items inside a single column into complete, logical lines.
 * Re-orders elements from left-to-right to support natural reading orders and calculates bounding boxes.
 *
 * COORDINATE SYSTEM NOTES:
 *   - The standard PDF coordinate space uses bottom-left as (0, 0) Cartesian origin.
 *   - Y-values increase from bottom-to-top.
 *   - Sorting sorts by Y-value descending (top of the page down), then left-to-right (X ascending).
 *   - A vertical tolerance threshold determines if adjacent characters share a line or are separate.
 *
 * @param {object[]} items - Array of text items representing a single column.
 * @param {number} [tolerance=4] - Vertical point deviation allowed to merge items into the same line.
 * @param {number} [pageNum=1] - Current page number.
 * @returns {object[]} Array of processed line objects: `{ text, x, y, width, height, pageNum }`.
 */
function groupItemsIntoLines(items, tolerance = 4, pageNum = 1) {
  if (!items.length) return [];

  // Sort items top-to-bottom (Y descending), then left-to-right (X ascending)
  const sorted = [...items].sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > tolerance) return dy; // Distinct lines
    return a.x - b.x; // Same line, order left-to-right
  });

  const lineGroups = [];
  let currentGroup = [sorted[0]];
  let currentY = sorted[0].y;

  // Cluster adjacent elements that are close vertically into group lists
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

  // Map groups into detailed line records containing aggregated text and visual bounding box dimensions
  return lineGroups.map(group => {
    const sortedGroup = group.sort((a, b) => a.x - b.x);
    const text = sortedGroup
      .map(item => item.str)
      .join(' ')
      .replace(/\s{3,}/g, '\t') // Compress large whitespace dividers into single tab characters
      .trim();

    // Mathematically derive the visual bounding box coordinates surrounding this entire line.
    // X and Y take the minimum visual start boundaries, and width/height span the outer edges.
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

    // ── District ──
    if ((line.includes('জেলা') || line.includes('জেলা:'))) {
      const m = line.match(/জেলা[:\s।]+(.+)/u);
      if (m && !meta.district) meta.district = m[1].trim().replace(/[\u0964\u0965]/g, '').split(/\s{2,}/)[0].trim();
      // If label only (no value after colon), take next line
      if (!meta.district && nextLine && !nextLine.includes(':')) {
        meta.district = nextLine.trim();
      }
    }

    // ── Upazila ──
    if (line.includes('উপজেলা') || line.includes('থানা')) {
      const m = line.match(/(?:উপজেলা|থানা)[/\s]*(?:থানা)?[:\s।]+(.+)/u);
      if (m && !meta.upazila) {
        meta.upazila = m[1].trim().split(/\s{2,}/)[0].trim();
      }
      // If label only (no value after colon), take next line
      if (!meta.upazila && nextLine && !nextLine.includes(':') && !nextLine.includes('ইউনিয়ন')) {
        meta.upazila = nextLine.trim();
      }
    }

    // ── Union/Ward ──
    if (line.includes('ইউনিয়ন') || line.includes('ওয়ার্ড/') || line.includes('ওয়াডে')) {
      const m = line.match(/(?:ইউনিয়ন|ওয়ার্ড|ওয়াডে)[^:]*[:\s।]+(.+)/u);
      if (m && !meta.unionName) {
        meta.unionName = m[1].trim().split(/\s{2,}/)[0].trim();
      }
      // If label only, take next non-label line
      if (!meta.unionName) {
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const nl = lines[j].trim();
          if (nl && !nl.includes(':') && !nl.includes('ওয়ার্ড') && !nl.includes('ওয়াডে') && 
              !nl.includes('ক্যাণ্ট') && !nl.includes('বোর্ড') && !nl.includes('বোডে')) {
            meta.unionName = nl;
            break;
          }
        }
      }
    }

    // ── Ward Number ──
    if (line.includes('ওয়ার্ড নম্বর') || line.includes('ওয়ার্ড নং') ||
        line.includes('ওয়াডে নম্বর') || line.includes('ওয়াডে নং')) {
      const m = line.match(/(?:ওয়ার্ড|ওয়াডে)\s*(?:নম্বর|নং)[^:]*[:\s।]+([০-৯\d]+)/u);
      if (m) meta.wardNo = m[1].trim();
      // If no number on same line, check next
      if (!meta.wardNo && nextLine && /^[০-৯\d]+$/.test(nextLine.trim())) {
        meta.wardNo = nextLine.trim();
      }
    }

    // ── Voter Area Number ──
    if (line.includes('ভোটার এলাকার নম্বর') || line.includes('ভোটার এলাকা নম্বর') || line.includes('ভোটার এলাকার কোড')) {
      const m = line.match(/ভোটার এলাকা(?:র)?\s*(?:নম্বর|কোড)[:\s।]+([০-৯\d]+)/u);
      if (m) meta.voterAreaNo = m[1].trim();
      if (!meta.voterAreaNo && nextLine && /^[০-৯\d]+$/.test(nextLine.trim())) {
        meta.voterAreaNo = nextLine.trim();
      }
    }

    // ── Voter Area Name ──
    if (line.includes('ভোটার এলাকা') && !line.includes('নম্বর') && !line.includes('কোড')) {
      const m = line.match(/ভোটার এলাকা(?:র নাম)?[:\s।]*(.+)/u);
      if (m && !meta.voterArea) meta.voterArea = m[1].trim().split(/\s{2,}/)[0].trim();
      if (!meta.voterArea && nextLine && !nextLine.includes(':')) {
        meta.voterArea = nextLine.trim();
      }
    }

    // ── Total Voters ──
    if (line.includes('সর্বমোট ভোটার') || line.includes('সবমোট ভোটার')) {
      const m = line.match(/(?:সর্ব|সব)মোট ভোটার[^:]*[:\s।]+([০-৯\d,]+)/u);
      if (m) meta.totalVoters = parseBengaliNumber(m[1]);
      if (!meta.totalVoters && nextLine && /^[০-৯\d,]+$/.test(nextLine.trim())) {
        meta.totalVoters = parseBengaliNumber(nextLine.trim());
      }
    }

    // ── Male/Female voters ──
    if (line.includes('মোট পুরুষ')) {
      const m = line.match(/মোট পুরুষ[^:]*[:\s।]+([০-৯\d,]+)/u);
      if (m) { meta.totalMaleVoters = parseBengaliNumber(m[1]); meta.genderType = 'পুরুষ'; }
      if (!meta.totalMaleVoters && nextLine && /^[০-৯\d,]+$/.test(nextLine.trim())) {
        meta.totalMaleVoters = parseBengaliNumber(nextLine.trim()); meta.genderType = 'পুরুষ';
      }
    }
    if (line.includes('মোট মহিলা')) {
      const m = line.match(/মোট মহিলা[^:]*[:\s।]+([০-৯\d,]+)/u);
      if (m) { meta.totalFemaleVoters = parseBengaliNumber(m[1]); meta.genderType = 'মহিলা'; }
    }
    if (line.includes('তালিকা') && (line.includes('পুরুষ') || line.includes('মহিলা'))) {
      if (line.includes('মহিলা')) meta.genderType = 'মহিলা';
      else if (line.includes('পুরুষ')) meta.genderType = 'পুরুষ';
    }

    // ── Publication Date ──
    if (line.includes('প্রকাশের তারিখ') || line.includes('প্রকাশ তারিখ') || line.includes('প্রকাশের তারিখ')) {
      const m = line.match(/(?:প্রকাশ(?:ের)? তারিখ)[:\s।]+([০-৯\d/]+)/u);
      if (m) meta.publicationDate = m[1].trim();
    }

    // ── Postal Code ──
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
 * Parses all voter entries from flat visual line structures.
 * 
 * DESIGN DETAILS & EC LAYOUT SCHEMA:
 *   - Each page typically contains exactly 15 voter cards (VOTERS_PER_PAGE = 15).
 *   - A voter block starts with a serial number: e.g. "০০১. নাম: শেখ ওবায়েদ" or "001. শেখ ওবায়েদ".
 *   - The name may wrap to a second line.
 *   - Subsequent lines contain voter fields: "ভোটার নং", "পিতা", "মাতা", "পেশা", "জন্ম তারিখ", "ঠিকানা".
 *   - The parser reads a serial line, extracts the name, and then looks ahead up to 12 lines 
 *     to parse related metadata fields, breaking early if it encounters the next voter's serial line.
 *   - Validation: We require a valid name and at least one parent name or voter number 
 *     to ignore header/footer decoration noise.
 *
 * @param {object[]} allLineObjs - Pre-sorted horizontal visual line objects containing `{ text, x, y, width, height, pageNum }`.
 * @param {object} coverMeta - Cover metadata extracted from Page 1 (provides fallbacks for village/district).
 * @param {string} pdfId - UUID matching the uploaded document.
 * @returns {object[]} Fully structured voter records matching the database schema.
 */
function extractVoters(allLineObjs, coverMeta, pdfId) {
  const voters = [];
  let lastSerialNum = 0;
  let i = 0;

  // Process all page lines sequentially
  while (i < allLineObjs.length) {
    const lineObj = allLineObjs[i];
    const line = lineObj.text;

    // Pattern: 2 to 4 Bengali/English digits, followed by a dot, optional spaces, and the voter's name.
    // Examples: " ০০১." or "001. নাম:" or "০০২. মোঃ রহিম"
    const serialMatch = line.match(/^\s*([০-৯\d]{2,4})\.[\s।]*(?:নাম\s*[:।]\s*)?(.+)/u);

    if (serialMatch) {
      const serialStr = serialMatch[1];
      const serialNum = parseBengaliNumber(serialStr);

      // Verify that this is a valid positive serial number
      if (serialNum > 0) {
        lastSerialNum = serialNum;

        // Clean up common prefix noise (like "নাম:") and strip punctuation
        let nameBn = cleanNamePrefix(serialMatch[2]);

        let voterNo = '';
        let fatherName = '';
        let motherName = '';
        let occupation = '';
        let dob = '';
        let address = '';

        // LOOKAHEAD MECHANISM: Read up to 12 lines after the serial declaration 
        // to parse this voter's associated card attributes.
        let j = i + 1;
        let linesRead = 0;

        while (j < allLineObjs.length && linesRead < 12) {
          const next = allLineObjs[j].text.trim();

          // If we hit another voter's serial starting block, terminate the lookahead immediately.
          if (next.match(/^\s*[০-৯\d]{2,4}\.[\s।]/u)) break;

          // 1. Parse voter number (supports common Bengali OCR corruptions like "ভাটার নং")
          if (/(?:ভোটার|ভাটার)\s*(?:নং|নম্বর)/u.test(next)) {
            const m = next.match(/(?:ভোটার|ভাটার)\s*(?:নং|নম্বর)\s*[:।]*\s*([০-৯\d]+)/u);
            if (m) voterNo = m[1].trim();
          }
          // 2. Parse Father's name (exclude mother or occupation references)
          else if (/পিতা/u.test(next) && !next.includes('মাতা')) {
            const m = next.match(/পita\s*[:।]*\s*(.+)/u) || next.match(/পিতা\s*[:।]*\s*(.+)/u);
            if (m) fatherName = m[1].replace(/মাতা.*/u, '').replace(/পেশা.*/u, '').trim();
          }
          // 3. Parse Mother's name
          else if (/মাতা/u.test(next)) {
            const m = next.match(/মাতা\s*[:।]*\s*(.+)/u);
            if (m) motherName = m[1].replace(/পেশা.*/u, '').trim();
          }
          // 4. Parse Occupation & DOB (they often sit on the same horizontal line in standard lists)
          else if (/পেশা/u.test(next)) {
            const dateMatch = next.match(/([০-৯\d]{1,2}\/[০-৯\d]{1,2}\/[০-৯\d]{4})/u);
            if (dateMatch) {
              dob = dateMatch[1];
              // Split occupation from birthdate
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
          // 5. Parse standalone Date of Birth
          else if (/জন্ম\s*তারিখ/u.test(next)) {
            const m = next.match(/([০-৯\d]{1,2}\/[০-৯\d]{1,2}\/[০-৯\d]{4})/u);
            if (m) dob = m[1];
          }
          // 6. Parse physical address
          else if (/ঠিকানা\s*[:।]/u.test(next)) {
            const m = next.match(/ঠিকানা\s*[:।]\s*(.+)/u);
            if (m) address = m[1].trim();
          }
          // 7. Parse wrapped name text: If the line doesn't match any key but is pure Bengali text,
          // it represents a wrapped second line of the voter's name.
          else if (!voterNo && !fatherName && nameBn.length < 40 && /^[\u0980-\u09FF\s]+$/.test(next)) {
            nameBn += ' ' + next;
          }

          j++;
          linesRead++;
        }

        // Clean name from lingering punctuation
        nameBn = cleanNamePrefix(nameBn);

        // STRANGE NOISE FILTER: Require at least one parent name or voter number 
        // to prevent page decorations, headers, and notices from entering the database.
        if (nameBn && nameBn.length > 1 && (voterNo || fatherName || motherName)) {
          const pdfPageNumber = lineObj.pageNum;
          // Calculate grid coordinates and page indices (1-15 grid placement)
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

// ── Bengali Correction Pipeline ─────────────────────────────────────────────

/**
 * Apply the full Bengali correction pipeline to extracted voter records.
 * This is the CRITICAL step that was previously missing, causing corrupted Bengali.
 *
 * Pipeline:
 *   1. correctText() — dictionary-based word correction on all text fields
 *   2. correctName() — fuzzy/phonetic name correction on name fields
 *   3. validateAddress() — geographic field correction
 *
 * @param {object[]} voters - Array of raw voter records after extraction
 * @param {object} coverMeta - Cover page metadata
 * @param {string} reqId - Request ID for logging
 * @returns {object} - { voters: corrected voters, corrections: stats }
 */
function applyCorrections(voters, coverMeta, reqId = null) {
  let totalCorrections = 0;
  let nameCorrections = 0;
  let dictCorrections = 0;
  let geoCorrections = 0;

  const correctedVoters = voters.map(voter => {
    // 1. Dictionary correction on all text fields
    const textFields = ['nameBn', 'fatherName', 'motherName', 'occupation', 'address'];
    for (const field of textFields) {
      if (voter[field] && voter[field].length > 0) {
        const result = correctText(voter[field]);
        if (result.correctionCount > 0) {
          voter[field] = result.corrected;
          dictCorrections += result.correctionCount;
          totalCorrections += result.correctionCount;
        }
      }
    }

    // 2. Name correction on person name fields
    const nameFields = ['nameBn', 'fatherName', 'motherName'];
    for (const field of nameFields) {
      if (voter[field] && voter[field].length > 1) {
        const result = correctName(voter[field], 0.80);
        if (result.corrections && result.corrections.length > 0) {
          voter[field] = result.corrected;
          nameCorrections += result.corrections.length;
          totalCorrections += result.corrections.length;
        }
      }
    }

    // 3. Geographic field correction
    if (voter.district || voter.upazila) {
      const addrResult = validateAddress({
        district: voter.district,
        upazila: voter.upazila,
      });
      if (addrResult.corrected) {
        if (addrResult.corrected.district && addrResult.corrected.district !== voter.district) {
          voter.district = addrResult.corrected.district;
          geoCorrections++;
          totalCorrections++;
        }
        if (addrResult.corrected.upazila && addrResult.corrected.upazila !== voter.upazila) {
          voter.upazila = addrResult.corrected.upazila;
          geoCorrections++;
          totalCorrections++;
        }
      }
    }

    return voter;
  });

  // Also correct cover metadata
  if (coverMeta.district) {
    const distResult = correctText(coverMeta.district);
    if (distResult.correctionCount > 0) coverMeta.district = distResult.corrected;
  }
  if (coverMeta.upazila) {
    const upResult = correctText(coverMeta.upazila);
    if (upResult.correctionCount > 0) coverMeta.upazila = upResult.corrected;
  }
  if (coverMeta.unionName) {
    const unResult = correctText(coverMeta.unionName);
    if (unResult.correctionCount > 0) coverMeta.unionName = unResult.corrected;
  }

  if (totalCorrections > 0) {
    logger.info(`Correction Pipeline: ${totalCorrections} total corrections (dict=${dictCorrections}, name=${nameCorrections}, geo=${geoCorrections})`, reqId);
  }

  return {
    voters: correctedVoters,
    corrections: { total: totalCorrections, dict: dictCorrections, name: nameCorrections, geo: geoCorrections },
  };
}

// ── OCR Fallback (for scanned PDFs) ─────────────────────────────────────────

/**
 * Attempt OCR on a scanned PDF using the OCR service.
 * Falls back gracefully if tesseract.js is not installed.
 */
async function ocrFallback(buffer, pdfId, fileName) {
  try {
    const ocrService = require('./ocrService');
    return await ocrService.processScannedPdf(buffer, pdfId, fileName);
  } catch (_) {
    logger.warn(`OCR not available for scanned PDF: ${fileName}. Install tesseract.js and canvas for OCR support.`);
    return {
      coverMeta: { district: '', upazila: '', unionName: '', wardNo: '', voterArea: '', voterAreaNo: '', totalVoters: 0, totalMaleVoters: 0, totalFemaleVoters: 0, genderType: 'পুরুষ', publicationDate: '', postCode: '' },
      voters: [],
      totalPages: 0,
      rawTextLength: 0,
      pdfType: 'scanned',
      encoding: 'unknown',
      warning: 'Scanned PDF detected. OCR not available — install: npm install tesseract.js canvas',
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
  const startTime = Date.now();
  logger.info(`PDF Parse Start: ${fileName}`, pdfId);

  // ── Step 1: Detect PDF type ──────────────────────────────────────────────
  let detection;
  try {
    detection = await detectPdfType(buffer);
  } catch (err) {
    logger.warn(`PDF type detection failed for ${fileName}, assuming legacy_font: ${err.message}`, pdfId);
    detection = { type: 'legacy_font', encoding: 'sutonny', totalPages: 0, confidence: 0.5, fontNames: [] };
  }

  logger.info(`PDF Type: ${detection.type} (confidence: ${(detection.confidence * 100).toFixed(0)}%) encoding=${detection.encoding} pages=${detection.totalPages}`, pdfId);
  if (detection.fontNames.length > 0) {
    logger.debug(`PDF Fonts: ${detection.fontNames.slice(0, 5).join(', ')}`, pdfId);
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

  logger.logBengaliConversion(detection.encoding, convertedPages.reduce((sum, p) => sum + p.lines.reduce((s, l) => s + l.text.length, 0), 0), pdfId);

  // ── Step 5: Build full text (mapping line objects to text for logging/compatibility) ──
  const fullText = convertedPages
    .map(p => p.lines.map(l => l.text).join('\n'))
    .join('\n');

  logger.debug(`PDF Sample (300 chars): ${fullText.substring(0, 300).replace(/\n/g, ' ')}`, pdfId);

  // ── Step 6: Extract cover page metadata from Page 1 only ─────────────────
  const page1 = convertedPages.find(p => p.pageNum === 1);
  const page1Text = page1 ? page1.lines.map(l => l.text).join('\n') : '';
  logger.debug(`Cover Page1 Lines:\n${page1Text}`, pdfId);
  const coverMeta = extractCoverPageData(page1Text);
  logger.info(`Cover Meta: district=${coverMeta.district || '(none)'} upazila=${coverMeta.upazila || '(none)'} union=${coverMeta.unionName || '(none)'} ward=${coverMeta.wardNo || '(none)'} area=${coverMeta.voterArea || '(none)'}`, pdfId);

  // ── Step 7: Extract voter records strictly from Page 3 onwards ──────────
  const voterPages = convertedPages.filter(p => p.pageNum >= 3);
  const voterLineObjects = [];
  for (const page of voterPages) {
    voterLineObjects.push(...page.lines);
  }
  const rawVoters = extractVoters(voterLineObjects, coverMeta, pdfId);

  // ── Step 8: Apply Bengali Correction Pipeline ──────────────────────────
  const { voters, corrections } = applyCorrections(rawVoters, coverMeta, pdfId);

  const duration = Date.now() - startTime;
  logger.logPdfParsing(voters.length, rawPages.totalPages, duration, pdfId);
  logger.info(`Corrections applied: ${corrections.total} (dict=${corrections.dict}, name=${corrections.name}, geo=${corrections.geo})`, pdfId);

  return {
    coverMeta,
    voters,
    totalPages: rawPages.totalPages,
    rawTextLength: fullText.length,
    pdfType: detection.type,
    encoding: detection.encoding,
    confidence: detection.confidence,
    corrections,
  };
}

module.exports = { parsePdfBuffer, parseBengaliNumber, extractCoverPageData };
