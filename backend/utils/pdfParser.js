'use strict';

/**
 * pdfParser utility — lightweight wrapper over pdfParserService.
 * Maintained for backward compatibility with any code that imports this module.
 */

const { parsePdfBuffer } = require('../services/pdfParserService');

/**
 * Parse a voter PDF buffer and return text + metadata.
 *
 * @param {Buffer} pdfBuffer - multer memory buffer
 * @returns {Promise<{ text: string, totalPages: number, metadata: object }>}
 */
const parseVoterPdfBuffer = async (pdfBuffer) => {
  try {
    const result = await parsePdfBuffer(pdfBuffer, 'temp-id', 'unnamed.pdf');
    // Build flat text from result for compatibility
    const text = [
      result.coverMeta ? JSON.stringify(result.coverMeta) : '',
      ...(result.voters || []).map(v => `${v.serialNo}. ${v.nameBn} ${v.fatherName} ${v.motherName}`),
    ].join('\n');

    return {
      text,
      totalPages: result.totalPages || 0,
      metadata: result.coverMeta || {},
      pdfType: result.pdfType,
      encoding: result.encoding,
    };
  } catch (error) {
    console.error('❌ Error parsing voter PDF document:', error.message);
    throw new Error(`PDF parse utility failed: ${error.message}`);
  }
};

module.exports = { parseVoterPdfBuffer };
