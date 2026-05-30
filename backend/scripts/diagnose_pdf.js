'use strict';
/**
 * Diagnostic: Extract raw text from the uploaded PDF using pdfjs-dist
 * WITHOUT any SutonnyMJ/Bijoy conversion, to prove the root cause.
 */
const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const UPLOADS_DIR = path.join(__dirname, '../uploads');

async function diagnose() {
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.pdf'));
  if (files.length === 0) { console.log('No PDF files found.'); return; }

  const filePath = path.join(UPLOADS_DIR, files[0]);
  console.log(`\nDiagnosing: ${files[0]}\n`);

  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer);

  const pdf = await pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: false,
    standardFontDataUrl: null,
  }).promise;

  console.log(`Total pages: ${pdf.numPages}\n`);

  // Extract pages 1-3
  for (let pageNum = 1; pageNum <= Math.min(3, pdf.numPages); pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    console.log(`\n===== PAGE ${pageNum} =====`);
    
    // Show raw items with font info
    const items = textContent.items.filter(i => i.str && i.str.trim());
    
    // Analyze character ranges
    let bengaliChars = 0, latinExtChars = 0, asciiChars = 0, totalChars = 0;
    const fontNames = new Set();
    
    for (const item of items) {
      if (item.fontName) fontNames.add(item.fontName);
      for (const ch of item.str) {
        totalChars++;
        const cp = ch.codePointAt(0);
        if (cp >= 0x0980 && cp <= 0x09FF) bengaliChars++;
        else if (cp >= 0x00C0 && cp <= 0x024F) latinExtChars++;
        else if (cp >= 0x0020 && cp <= 0x007E) asciiChars++;
      }
    }
    
    console.log(`Fonts found: ${[...fontNames].join(', ')}`);
    console.log(`Character analysis: Bengali=${bengaliChars}, LatinExt=${latinExtChars}, ASCII=${asciiChars}, Total=${totalChars}`);
    console.log(`Bengali ratio: ${(bengaliChars/totalChars*100).toFixed(1)}%`);
    console.log(`LatinExt ratio: ${(latinExtChars/totalChars*100).toFixed(1)}%`);
    
    // Show first 30 text items raw
    console.log(`\nFirst 30 raw text items:`);
    for (let i = 0; i < Math.min(30, items.length); i++) {
      const item = items[i];
      const hex = [...item.str].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
      console.log(`  [${i}] font=${item.fontName} x=${item.transform?.[4]?.toFixed(0)} y=${item.transform?.[5]?.toFixed(0)} str="${item.str}" hex=[${hex}]`);
    }
    
    // Reconstruct lines
    const lineItems = [...items].sort((a, b) => {
      const dy = (b.transform?.[5] || 0) - (a.transform?.[5] || 0);
      if (Math.abs(dy) > 4) return dy;
      return (a.transform?.[4] || 0) - (b.transform?.[4] || 0);
    });
    
    let lines = [];
    let currentLine = [lineItems[0]];
    let currentY = lineItems[0]?.transform?.[5] || 0;
    
    for (let i = 1; i < lineItems.length; i++) {
      const y = lineItems[i].transform?.[5] || 0;
      if (Math.abs(y - currentY) <= 4) {
        currentLine.push(lineItems[i]);
      } else {
        lines.push(currentLine.map(it => it.str).join(' '));
        currentLine = [lineItems[i]];
        currentY = y;
      }
    }
    if (currentLine.length) lines.push(currentLine.map(it => it.str).join(' '));
    
    console.log(`\nReconstructed lines (first 20):`);
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      console.log(`  L${i}: ${lines[i]}`);
    }
    
    page.cleanup();
  }
  
  await pdf.destroy();
  console.log('\nDiagnosis complete.');
}

diagnose().catch(err => { console.error('Error:', err); process.exit(1); });
