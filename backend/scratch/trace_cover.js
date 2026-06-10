const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';
const fs = require('fs');
const { autoConvert } = require('../utils/bengaliUnicodeConverter');

// Simulate extractCoverPageData inline
function parseBengaliNumber(str) {
  if (!str) return 0;
  const map = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
  return parseInt(str.replace(/[,\s]/g, '').split('').map(c => map[c] || c).join('')) || 0;
}

async function check() {
  const buffer = fs.readFileSync('./uploads/01aee2ee-8ca4-4277-b8a2-d514e65869fb.pdf');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false }).promise;
  const page = await pdf.getPage(1);
  const tc = await page.getTextContent();
  const items = tc.items.filter(i => i.str && i.str.trim());
  const text = items.map(i => autoConvert(i.str).text).join('\n');

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  console.log('Lines:');
  lines.forEach((l, i) => console.log(`  [${i}] "${l}"`));

  // Test upazila extraction
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

    if (line.includes('উপজেলা') || line.includes('থানা')) {
      console.log('\n>>> Upazila line found at [' + i + ']: "' + line + '"');
      const m = line.match(/(?:উপজেলা|থানা)[/\s]*(?:থানা)?[:\s।]+(.+)/u);
      console.log('  Regex match:', m ? m[1] : 'null');
      console.log('  Next line: "' + nextLine + '"');
      console.log('  Next has colon:', nextLine.includes(':'));
      console.log('  Next has ইউনিয়ন:', nextLine.includes('ইউনিয়ন'));
    }

    if (line.includes('ইউনিয়ন')) {
      console.log('\n>>> Union line found at [' + i + ']: "' + line + '"');
      const m = line.match(/(?:ইউনিয়ন|ওয়ার্ড|ওয়াডে)[^:]*[:\s।]+(.+)/u);
      console.log('  Regex match:', m ? m[1] : 'null');
    }
  }

  await pdf.destroy();
}

check().catch(err => console.error(err));
