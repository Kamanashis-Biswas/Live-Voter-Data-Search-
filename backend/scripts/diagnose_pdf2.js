'use strict';
/**
 * Diagnostic 2: Check all pages for text content vs image-only
 */
const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const UPLOADS_DIR = path.join(__dirname, '../uploads');
// Suppress canvas warnings
const _w = console.warn.bind(console);
console.warn = (...a) => { if (String(a[0]||'').includes('Cannot polyfill')) return; _w(...a); };

async function diagnose() {
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.pdf'));
  const filePath = path.join(UPLOADS_DIR, files[0]);
  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer);

  const pdf = await pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: false,
    standardFontDataUrl: null,
  }).promise;

  console.log(`Total pages: ${pdf.numPages}\n`);
  console.log('Page-by-page text content analysis:');
  console.log('─'.repeat(60));

  let pagesWithText = 0;
  let pagesEmpty = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim());
    const totalChars = items.reduce((s, i) => s + i.str.length, 0);
    
    // Check for images (XObjects)
    const ops = await page.getOperatorList();
    let imageCount = 0;
    for (const op of ops.fnArray) {
      if (op === pdfjsLib.OPS.paintImageXObject || op === pdfjsLib.OPS.paintJpegXObject) {
        imageCount++;
      }
    }
    
    if (totalChars > 0) pagesWithText++;
    else pagesEmpty++;
    
    const status = totalChars > 10 ? '✅ TEXT' : totalChars > 0 ? '⚠️  FEW' : '❌ EMPTY';
    console.log(`  Page ${String(p).padStart(3)}: ${status} | chars=${String(totalChars).padStart(5)} | items=${String(items.length).padStart(4)} | images=${imageCount}`);
    
    // Show first 100 chars of text content for text pages
    if (totalChars > 0 && p <= 5) {
      const preview = items.map(i => i.str).join(' ').substring(0, 120);
      console.log(`         Preview: "${preview}"`);
    }
    
    page.cleanup();
  }

  console.log('─'.repeat(60));
  console.log(`\nSummary: ${pagesWithText} pages with text, ${pagesEmpty} empty pages`);
  console.log(`If most pages are EMPTY but the PDF renders correctly in a browser, then\nthe voter data is RENDERED AS IMAGES (not extractable text).`);

  await pdf.destroy();
}

diagnose().catch(err => { console.error('Error:', err.message); process.exit(1); });
