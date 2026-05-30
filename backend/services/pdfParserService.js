const pdfParse = require('pdf-parse');
const path = require('path');

/**
 * Parses a voter list PDF and extracts structured voter records.
 * Handles the standard Bangladesh Election Commission voter list format.
 */

// Try to extract cover page metadata from PDF text
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
    if (line.includes('জেলা') || line.includes('জেলা:')) {
      const m = line.match(/জেলা[:\s।]+(.+)/u);
      if (m) meta.district = m[1].trim().replace(/[\u0964\u0965]/g, '').trim();
    }
    if (line.includes('উপজেলা') || line.includes('থানা')) {
      const m = line.match(/(?:উপজেলা|থানা)[/\s]*(?:থানা)?[:\s।]+(.+)/u);
      if (m) meta.upazila = m[1].trim().split(/\s{2,}/)[0].trim();
    }
    if (line.includes('ইউনিয়ন') || line.includes('ওয়ার্ড/কাঃ বোঃ')) {
      const m = line.match(/(?:ইউনিয়ন|ওয়ার্ড)[^:]*[:\s।]+(.+)/u);
      if (m) meta.unionName = m[1].trim().split(/\s{2,}/)[0].trim();
    }
    if (line.includes('ওয়ার্ড নম্বর') || line.includes('ওয়ার্ড নং')) {
      const m = line.match(/ওয়ার্ড নম্বর[^:]*[:\s।]+([০-৯\d]+)/u);
      if (m) meta.wardNo = m[1].trim();
    }
    if (line.includes('ভোটার এলাকার নম্বর') || line.includes('ভোটার এলাকা নম্বর')) {
      const m = line.match(/ভোটার এলাকার? নম্বর[:\s।]+([০-৯\d]+)/u);
      if (m) meta.voterAreaNo = m[1].trim();
    }
    if (line.includes('ভোটার এলাকা') && !line.includes('নম্বর')) {
      const m = line.match(/ভোটার এলাকা[:\s।]*(.+)/u);
      if (m) meta.voterArea = m[1].trim().split(/\s{2,}/)[0].trim();
    }
    if (line.includes('সর্বমোট ভোটার')) {
      const m = line.match(/সর্বমোট ভোটার[^:]*[:\s।]+([০-৯\d,]+)/u);
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
    if (line.includes('প্রকাশের তারিখ') || line.includes('প্রকাশ তারিখ')) {
      const m = line.match(/(?:প্রকাশ(?:ের)? তারিখ)[:\s।]+([০-৯\d/]+)/u);
      if (m) meta.publicationDate = m[1].trim();
    }
    if (line.includes('পোস্টকোড') || line.includes('পোষ্টকোড')) {
      const m = line.match(/পো(?:স্ট|ষ্ট)কোড[:\s।]+([০-৯\d]+)/u);
      if (m) meta.postCode = m[1].trim();
    }
    if (line.includes('ডাকঘর') || line.includes('ডাকঃ')) {
      const m = line.match(/ডাক(?:ঘর)?[:\s।]*(.+)/u);
      if (m && !meta.voterArea) meta.voterArea = m[1].trim().split(/\s{2,}/)[0].trim();
    }
  }

  return meta;
}

// Parse Bengali/English number
function parseBengaliNumber(str) {
  if (!str) return 0;
  const bengaliMap = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  return parseInt(str.replace(/[,]/g, '').split('').map(c => bengaliMap[c] || c).join('')) || 0;
}

/**
 * Extract voter records from PDF text.
 * The voter list has a 3-column grid layout per page.
 * Each voter entry has: serial, name, voter_no, father, mother, occupation, dob, address
 */
function extractVoters(text, coverMeta, pdfId, fileName) {
  const voters = [];
  const { v4: uuidv4 } = require('uuid');
  
  // Split text into lines
  const lines = text.split('\n').map(l => l.trim());
  
  let i = 0;
  let lastSerialNum = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Match voter entry start: "০০১. নাম: ..." or "০০১. নাম ..."
    // Bengali digits followed by dot and "নাম"
    const serialMatch = line.match(/^([০-৯]{3,4})\.\s*(?:নাম\s*[:।]\s*)?(.+)/u);
    
    if (serialMatch) {
      const serialStr = serialMatch[1];
      const serialNum = parseBengaliNumber(serialStr);
      
      if (serialNum > 0 && serialNum > lastSerialNum - 5) {
        // This looks like a valid voter entry
        lastSerialNum = serialNum;
        
        let nameBn = serialMatch[2].trim();
        // Remove "নাম:" prefix if present
        nameBn = nameBn.replace(/^নাম\s*[:।]\s*/u, '').trim();
        
        let voterNo = '';
        let fatherName = '';
        let motherName = '';
        let occupation = '';
        let dob = '';
        let address = '';
        
        // Read subsequent lines for this voter (up to 8 lines)
        let j = i + 1;
        let linesRead = 0;
        while (j < lines.length && linesRead < 10) {
          const nextLine = lines[j].trim();
          
          // Stop if we hit the next voter entry
          if (nextLine.match(/^[০-৯]{3,4}\.\s*নাম/u)) break;
          if (nextLine.match(/^[০-৯]{3,4}\.\s*[ক-ঢ়]+/u) && !nextLine.includes('নাম')) {
            // Could be next voter if serial is sequential
            const nextSerial = nextLine.match(/^([০-৯]{3,4})\./u);
            if (nextSerial && parseBengaliNumber(nextSerial[1]) === serialNum + 1) break;
          }
          
          if (nextLine.includes('ভাটার নং:') || nextLine.includes('ভোটার নং:') || nextLine.includes('ভাটার ন')) {
            const m = nextLine.match(/(?:ভাটার|ভোটার)\s*নং\s*[:।]\s*([০-৯\d]+)/u);
            if (m) voterNo = m[1].trim();
          } else if (nextLine.includes('িপতা:') || nextLine.includes('পিতা:') || nextLine.startsWith('িপতা') || nextLine.startsWith('পিতা')) {
            const m = nextLine.match(/(?:িপতা|পিতা)\s*[:।]\s*(.+)/u);
            if (m) fatherName = m[1].replace(/মাতা.*|পেশা.*/u, '').trim();
          } else if (nextLine.includes('মাতা:') || nextLine.startsWith('মাতা')) {
            const m = nextLine.match(/মাতা\s*[:।]\s*(.+)/u);
            if (m) motherName = m[1].replace(/পেশা.*/u, '').trim();
          } else if (nextLine.includes('পেশা') || nextLine.includes('Ïপশা') || nextLine.includes('েপশা')) {
            const m = nextLine.match(/(?:পেশা|Ïপশা|েপশা)\s*[:।,]\s*(.+)/u);
            if (m) {
              const parts = m[1].split(/[,জন্ম]/u);
              occupation = parts[0].trim();
              // Extract DOB if in same line
              const dobM = nextLine.match(/([০-৯\d]{2}\/[০-৯\d]{2}\/[০-৯\d]{4})/u);
              if (dobM) dob = dobM[1];
            }
          } else if (nextLine.includes('জī তািরখ') || nextLine.includes('জন্ম তারিখ') || nextLine.includes('জĴ তারিখ')) {
            const m = nextLine.match(/([০-৯\d]{2}\/[০-৯\d]{2}\/[০-৯\d]{4})/u);
            if (m) dob = m[1];
          } else if (nextLine.includes('িঠকানা:') || nextLine.includes('ঠিকানা:') || nextLine.startsWith('িঠকানা') || nextLine.startsWith('ঠিকানা')) {
            const m = nextLine.match(/(?:িঠকানা|ঠিকানা)\s*[:।]\s*(.+)/u);
            if (m) address = m[1].trim();
          }
          
          j++;
          linesRead++;
        }
        
        if (nameBn && nameBn.length > 1) {
          // Calculate page position
          const VOTERS_PER_PAGE = 15;
          const voterPageIndex = Math.ceil(serialNum / VOTERS_PER_PAGE);
          const pdfPageNumber = voterPageIndex + 1; // +1 for cover page
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
            address: address || `${coverMeta.voterArea}, ${coverMeta.upazila}, ${coverMeta.district}`,
            status: 'সক্রিয়',
            pdfUploadId: pdfId,
            pdfPageNumber,
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

function parseVoterBlock(block, serialStr, serialNum, coverMeta, pdfId, defaultPage) {
  try {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    
    let nameBn = '';
    let voterNo = '';
    let fatherName = '';
    let motherName = '';
    let occupation = '';
    let dob = '';
    let address = '';
    
    for (const line of lines) {
      if (line.match(/^[০-৯\d]{3,4}[\.।]/)) {
        // First line: serial and possibly name
        const nameMatch = line.match(/[০-৯\d]{3,4}[\.।]\s*(?:নাম\s*[:।]\s*)?(.+)/u);
        if (nameMatch && !nameBn) nameBn = nameMatch[1].trim();
      }
      
      if (line.includes('নাম') && line.includes(':') && !nameBn) {
        const m = line.match(/নাম\s*[:।]\s*(.+)/u);
        if (m) nameBn = m[1].replace(/ভোটার.*/, '').trim();
      }
      
      if (line.includes('ভোটার নং') || line.includes('ভোটার নঃ') || line.includes('ভোটার নo')) {
        const m = line.match(/ভোটার\s*ন[ংঃo][:\s।]*([০-৯\d]+)/u);
        if (m) voterNo = m[1].trim();
      }
      
      if (line.includes('পিতা') || line.includes('পিতাঃ')) {
        const m = line.match(/পিতা[াঃ]?[:।\s]+(.+)/u);
        if (m) fatherName = m[1].replace(/মাতা.*/, '').trim();
      }
      
      if (line.includes('মাতা') || line.includes('মাতাঃ')) {
        const m = line.match(/মাতা[াঃ]?[:।\s]+(.+)/u);
        if (m) motherName = m[1].replace(/পেশা.*/, '').trim();
      }
      
      if (line.includes('পেশা')) {
        const m = line.match(/পেশা[াঃ]?[:।\s]+(.+?)(?:জন্ম|$)/u);
        if (m) occupation = m[1].trim();
      }
      
      if (line.includes('জন্ম তারিখ') || line.includes('জন্মতারিখ')) {
        const m = line.match(/জন্ম\s*তারিখ[াঃ]?[:।\s]*([০-৯\d/]+)/u);
        if (m) dob = m[1].trim();
      }
      
      if (line.includes('ঠিকানা')) {
        const m = line.match(/ঠিকানা[াঃ]?[:।\s]+(.+)/u);
        if (m) address = m[1].trim();
      }
    }
    
    if (!nameBn) return null;
    
    const { v4: uuidv4 } = require('uuid');
    
    return {
      id: uuidv4(),
      serialNo: serialStr,
      serialNum,
      nameBn: nameBn.trim(),
      nameEn: '',
      voterNo: voterNo || '',
      nid: '',
      fatherName: fatherName || '',
      motherName: motherName || '',
      occupation: occupation || '',
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
      address: address || `${coverMeta.voterArea}, ${coverMeta.upazila}, ${coverMeta.district}`,
      status: 'সক্রিয়',
      pdfUploadId: pdfId,
      pdfPageNumber: defaultPage,
      serialOnPage: serialNum,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Main function: parse PDF buffer and return structured data
 */
async function parsePdfBuffer(buffer, pdfId, fileName) {
  try {
    const data = await pdfParse(buffer, {
      // Don't render PDF pages, just extract text
      pagerender: null
    });
    
    const fullText = data.text;
    const totalPages = data.numpages;
    
    // Extract cover page metadata
    const coverMeta = extractCoverPageData(fullText);
    
    // Extract voter records
    const voters = extractVoters(fullText, coverMeta, pdfId, fileName);
    
    return {
      coverMeta,
      voters,
      totalPages,
      rawTextLength: fullText.length
    };
  } catch (err) {
    console.error('PDF parse error:', err.message);
    throw new Error(`PDF parsing failed: ${err.message}`);
  }
}

module.exports = { parsePdfBuffer, parseBengaliNumber };
