const pdf = require('pdf-parse');

/**
 * Utility: Converts uploaded PDF binary buffers into clean string text.
 * @param {Buffer} pdfBuffer - The uploaded PDF file buffer from multer memoryStorage.
 * @returns {Promise<string>} Resolves with plain text parsed from the document.
 */
const parseVoterPdfBuffer = async (pdfBuffer) => {
  try {
    const options = {
      // Optional: Add custom layout mapping or page filters if needed
      max: 0, // Get all pages
    };
    
    const parsedData = await pdf(pdfBuffer, options);
    
    return {
      text: parsedData.text || '',
      totalPages: parsedData.numpaged || 0,
      metadata: parsedData.info || {}
    };
  } catch (error) {
    console.error('❌ Error parsing voter PDF document:', error.message);
    throw new Error(`PDF parse utility failed: ${error.message}`);
  }
};

module.exports = {
  parseVoterPdfBuffer
};
