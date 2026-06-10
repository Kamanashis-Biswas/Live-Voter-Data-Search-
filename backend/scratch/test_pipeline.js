// Simulate the actual pipeline
const pdfParserService = require('../services/pdfParserService');
const fs = require('fs');

async function check() {
  const buffer = fs.readFileSync('./uploads/01aee2ee-8ca4-4277-b8a2-d514e65869fb.pdf');
  const result = await pdfParserService.parsePdfBuffer(buffer, '011138_test.pdf', 'test-id');
  
  console.log('=== Cover Meta ===');
  console.log(JSON.stringify({
    district: result.metadata?.district,
    upazila: result.metadata?.upazila,
    unionName: result.metadata?.unionName,
    wardNo: result.metadata?.wardNo,
    voterArea: result.metadata?.voterArea,
  }, null, 2));
  
  console.log('\n=== Sample voter fields ===');
  const v = result.voters[0];
  console.log('occupation:', v.occupation);
  console.log('village:', v.village);
  console.log('voterArea:', v.voterArea);
  console.log('upazila:', v.upazila);
  console.log('district:', v.district);
  console.log('unionName:', v.unionName);
  console.log('wardNo:', v.wardNo);
}

check().catch(err => console.error(err));
