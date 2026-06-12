'use strict';

/**
 * @file geminiService.js
 * @description Google AI Studio (Gemini) API service for automated Bengali OCR text cleanup and spelling correction.
 *
 * Connects to Gemini's generative models to clean up spelling anomalies,
 * OCR artifacts, and font-mapping bugs at scale.
 *
 * @version 1.0.0
 */

const logger = require('../utils/logger');

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

/**
 * Check if the Gemini API Key is configured.
 * @returns {boolean} True if configured
 */
function isConfigured() {
  return GEMINI_API_KEY.length > 0;
}

/**
 * Clean and correct a list of voter records using Gemini API.
 *
 * @param {object[]} voters - Array of voter objects to correct
 * @returns {Promise<object[]>} The corrected voter objects
 */
async function correctVotersWithGemini(voters) {
  if (!isConfigured()) {
    logger.warn('Gemini API key is not configured. Add GEMINI_API_KEY to your backend/.env file.');
    return voters;
  }

  if (!voters || voters.length === 0) {
    return [];
  }

  logger.info(`Sending ${voters.length} voters to Gemini for AI correction...`);

  // Strip search normalizations to reduce payload size
  const payload = voters.map(v => ({
    id: v.id,
    serialNo: v.serialNo,
    nameBn: v.nameBn,
    fatherName: v.fatherName,
    motherName: v.motherName,
    occupation: v.occupation,
    address: v.address,
  }));

  const systemInstruction = 
    `You are a professional Bengali name normalization and OCR error correction assistant. ` +
    `Your task is to take a JSON array of voter records containing OCR errors (broken Unicode, spelling variations, font corruption) and correct the spelling of Bengali names, fathers' names, mothers' names, occupations, and addresses. ` +
    `Strict rules:\n` +
    `1. Correct OCR glyph corruptions (e.g. "বগম" -> "বেগম", "মহনতদ" -> "মোহাম্মদ", "মু্রা" -> "মুক্তা", "রাওাক" -> "রাজ্জাক", "নজিলা" -> "নিজেলা").\n` +
    `2. Keep common and valid names untouched (e.g. "রানী", "রিনা", "শাহিদা", "সুশীল" are valid names and should not be modified).\n` +
    `3. Ensure all serial numbers and IDs are preserved exactly.\n` +
    `4. Return ONLY a valid JSON array in the exact same format as the input. Do not include markdown code block syntax (like \`\`\`json) or any explanation. Output pure JSON only.`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: `Here is the JSON array of voter records to correct:\n${JSON.stringify(payload, null, 2)}` }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        { text: systemInstruction }
      ]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    const resultText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      throw new Error('Invalid response structure from Gemini API');
    }

    let correctedPayload;
    try {
      correctedPayload = JSON.parse(resultText.trim());
    } catch (e) {
      // In case it wrapped the response in markdown ```json blocks
      const cleanJson = resultText.replace(/```json|```/g, '').trim();
      correctedPayload = JSON.parse(cleanJson);
    }

    // Merge corrected fields back into the original voter objects (to preserve extra fields like normalName, etc.)
    const correctedVoters = voters.map(original => {
      const corrected = correctedPayload.find(c => c.id === original.id || c.serialNo === original.serialNo);
      if (corrected) {
        return {
          ...original,
          nameBn: corrected.nameBn || original.nameBn,
          fatherName: corrected.fatherName || original.fatherName,
          motherName: corrected.motherName || original.motherName,
          occupation: corrected.occupation || original.occupation,
          address: corrected.address || original.address
        };
      }
      return original;
    });

    logger.info(`Successfully completed AI correction for ${voters.length} voters.`);
    return correctedVoters;

  } catch (error) {
    logger.error('Gemini correction pipeline failed', error);
    // Fall back to original voters if API fails
    return voters;
  }
}

module.exports = {
  isConfigured,
  correctVotersWithGemini
};
