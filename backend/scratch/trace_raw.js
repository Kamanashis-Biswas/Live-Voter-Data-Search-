const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';
const fs = require('fs');
const { autoConvert } = require('../utils/bengaliUnicodeConverter');

async function check() {
  const buffer = fs.readFileSync('./uploads/01aee2ee-8ca4-4277-b8a2-d514e65869fb.pdf');
  const uint8 = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: false }).promise;
  
  // Check cover page (page 1) for upazila
  console.log('=== COVER PAGE (Page 1) ===\n');
  const coverPage = await pdf.getPage(1);
  const coverTC = await coverPage.getTextContent();
  const coverItems = coverTC.items.filter(i => i.str && i.str.trim());
  for (let i = 0; i < coverItems.length; i++) {
    const item = coverItems[i];
    const conv = autoConvert(item.str);
    console.log(`[${i}] raw="${item.str}" conv="${conv.text}" enc=${conv.encoding}`);
  }
  
  // Check page 2 for upazila/ward info
  console.log('\n=== PAGE 2 ===\n');
  const page2 = await pdf.getPage(2);
  const tc2 = await page2.getTextContent();
  const items2 = tc2.items.filter(i => i.str && i.str.trim());
  for (let i = 0; i < items2.length; i++) {
    const item = items2[i];
    const conv = autoConvert(item.str);
    console.log(`[${i}] raw="${item.str}" conv="${conv.text}" enc=${conv.encoding}`);
  }

  // Check page 3 for occupation "রমিক" 
  console.log('\n=== PAGE 3 (occupation lines) ===\n');
  const page3 = await pdf.getPage(3);
  const tc3 = await page3.getTextContent();
  const items3 = tc3.items.filter(i => i.str && i.str.trim());
  for (let i = 0; i < items3.length; i++) {
    const item = items3[i];
    const conv = autoConvert(item.str);
    if (conv.text.includes('পেশা') || conv.text.includes('রমিক') || conv.text.includes('শ্রমিক') ||
        item.str.includes('Ř') || item.str.includes('িমক') || item.str.includes('রমিক')) {
      const hex = [...item.str].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
      console.log(`[${i}] raw="${item.str}" hex=[${hex}] conv="${conv.text}" enc=${conv.encoding}`);
    }
  }
  
  // Check for "ওয়াডেরে" pattern
  console.log('\n=== WARD PATTERN ===\n');
  for (let i = 0; i < items3.length; i++) {
    const item = items3[i];
    const conv = autoConvert(item.str);
    if (conv.text.includes('ওয়া') || conv.text.includes('ওয়ার্ড') || item.str.includes('IqvW')) {
      const hex = [...item.str].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
      console.log(`[${i}] raw="${item.str}" hex=[${hex}] conv="${conv.text}" enc=${conv.encoding}`);
    }
  }

  await pdf.destroy();
}

check().catch(err => console.error(err));
