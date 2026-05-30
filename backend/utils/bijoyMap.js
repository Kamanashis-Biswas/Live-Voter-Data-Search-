'use strict';

/**
 * Bijoy / Bijoy Baijoy / Shree-Lipi → Unicode Bengali Glyph Map
 *
 * Bijoy is the other dominant legacy Bengali encoding, slightly different
 * from SutonnyMJ in some codepoint assignments.
 *
 * The PRE_MATRAS set is shared with SutonnyMJ.
 */

const { PRE_MATRAS } = require('./sutonnyMJMap');

/**
 * Bijoy-specific glyph map.
 * Differences from SutonnyMJ are in ASCII range (A-Z, a-z) where Bijoy
 * uses a different keyboard layout mapping.
 */
const BIJOY_MAP = {
  // Bijoy maps standard ASCII to Bengali consonants (keyboard layout)
  // Uppercase = vowels/special
  '\u0041': '\u0985', // A → অ
  '\u0042': '\u0986', // B → আ
  '\u0043': '\u09CE', // C → ৎ (khanda ta)
  '\u0044': '\u0981', // D → ঁ (chandrabindu)
  '\u0045': '\u099E', // E → ঞ
  '\u0046': '\u099C\u09CD\u099E', // F → জ্ঞ
  '\u0047': '\u0990', // G → ঐ
  '\u0048': '\u098F', // H → এ
  '\u0049': '\u0987', // I → ই
  '\u004A': '\u0988', // J → ঈ
  '\u004B': '\u0989', // K → উ
  '\u004C': '\u098A', // L → ঊ
  '\u004D': '\u09A3', // M → ণ
  '\u004E': '\u09A8', // N → ন
  '\u004F': '\u0993', // O → ও
  '\u0050': '\u09AE', // P → ম
  '\u0051': '\u09B9', // Q → হ
  '\u0052': '\u09A5', // R → থ
  '\u0053': '\u09A6', // S → দ
  '\u0054': '\u099F', // T → ট
  '\u0055': '\u09A5', // U → থ (alt)
  '\u0056': '\u09AD', // V → ভ
  '\u0057': '\u09B6', // W → শ
  '\u0058': '\u09B7', // X → ষ
  '\u0059': '\u09AF', // Y → য
  '\u005A': '\u09DF', // Z → য়

  // Lowercase = consonants and matras
  '\u0061': '\u09BE', // a → া  (aa-matra)
  '\u0062': '\u09AC', // b → ব
  '\u0063': '\u0995', // c → ক
  '\u0064': '\u09A6', // d → দ
  '\u0065': '\u09C7', // e → ে  [PRE-MATRA in Bijoy too]
  '\u0066': '\u09AB', // f → ফ
  '\u0067': '\u0997', // g → গ
  '\u0068': '\u09B9', // h → হ
  '\u0069': '\u09BF', // i → ি  [PRE-MATRA]
  '\u006A': '\u099C', // j → জ
  '\u006B': '\u0995', // k → ক
  '\u006C': '\u09B2', // l → ল
  '\u006D': '\u09AE', // m → ম
  '\u006E': '\u09A8', // n → ন
  '\u006F': '\u09CB', // o → ো
  '\u0070': '\u09AA', // p → প
  '\u0071': '\u099A', // q → চ
  '\u0072': '\u09B0', // r → র
  '\u0073': '\u09B8', // s → স
  '\u0074': '\u09A4', // t → ত
  '\u0075': '\u09C1', // u → ু
  '\u0076': '\u09AC', // v → ব (alt)
  '\u0077': '\u09C1', // w → ু (alt)
  '\u0078': '\u0995\u09CD\u09B7', // x → ক্ষ
  '\u0079': '\u09AF', // y → য
  '\u007A': '\u09CD', // z → ্  (hasanta/virama)

  // Latin Extended — same as SutonnyMJ for most entries
  '\u00CF': '\u09C7', // Ï → ে
  '\u00CE': '\u09C7', // Î → ে
  '\u0192': '\u09C1', // ƒ → ু
  '\u0191': '\u09C2', // Ƒ → ূ
  '\u0118': '\u09C7', // Ę → ে
  '\u0119': '\u09C8', // ę → ৈ
  '\u0102': '\u09BF', // Ă → ি
  '\u0103': '\u09BF', // ă → ি
  '\u011A': '\u09CC', // Ě → ৌ
  '\u011B': '\u09CB', // ě → ো
  '\u0130': '\u09CB', // İ → ো
  '\u0104': '\u09CB', // Ą → ো
  '\u0105': '\u09CB', // ą → ো
  '\u0154': '\u09B0\u09CD', // Ŕ → র্
  '\u0178': '\u09B0\u09CD', // Ÿ → র্
  '\u00D7': '\u09CD\u09B0', // × → ্র
  '\u0141': '\u09CD\u09AF', // Ł → ্য
  '\u0147': '\u09A8\u09CD\u09A4', // Ň → ন্ত
  '\u0148': '\u09A8\u09CD\u09A4', // ň → ন্ত
  '\u0126': '\u099C\u09CD\u099E', // Ħ → জ্ঞ
  '\u00D0': '\u09A6\u09CD\u09A7', // Ð → দ্ধ
  '\u00F0': '\u09A6\u09CD\u09A7', // ð → দ্ধ
  '\u00C6': '\u09AE\u09CD\u09AA', // Æ → ম্প
  '\u00E6': '\u09AE\u09CD\u09AA', // æ → ম্প
  '\u014A': '\u0999\u09CD\u0995', // Ŋ → ঙ্ক
  '\u014B': '\u0999\u09CD\u0995', // ŋ → ঙ্ক
  '\u015C': '\u09B6\u09CD\u099A', // Ŝ → শ্চ
  '\u015D': '\u09B7\u09CD\u09A3', // ŝ → ষ্ণ
  '\u00DE': '\u09A4\u09CD\u09AC', // Þ → ত্ব
  '\u00FE': '\u09A4\u09CD\u09AC', // þ → ত্ব
  '\u0001': '\u0964',              // SOH → ।
};

module.exports = { BIJOY_MAP, PRE_MATRAS };
