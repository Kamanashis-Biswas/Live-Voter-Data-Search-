const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';
const fs = require('fs');
const { autoConvert } = require('../utils/bengaliUnicodeConverter');

async function check() {
  const buffer = fs.readFileSync('./uploads/01aee2ee-8ca4-4277-b8a2-d514e65869fb.pdf');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false }).promise;
  const page = await pdf.getPage(1);
  const tc = await page.getTextContent();
  const items = tc.items.filter(i => i.str && i.str.trim());
  
  console.log('Page 1 items with X/Y coordinates:');
  for (const item of items) {
    const c = autoConvert(item.str, 'sutonny');
    const x = Math.round(item.transform[4]);
    const y = Math.round(item.transform[5]);
    console.log(`  x=${x} y=${y} "${c.text}"`);
  }
  
  await pdf.destroy();
}

check().catch(err => console.error(err));
