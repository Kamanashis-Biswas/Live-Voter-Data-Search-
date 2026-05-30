'use strict';

/**
 * SutonnyMJ / AdarshaLipi / Akaash / EC Custom Font → Unicode Bengali Glyph Map
 *
 * These legacy fonts encode Bengali by mapping Latin Extended codepoints
 * (U+0080–U+01FF) AND some standard ASCII characters to Bengali glyphs.
 * The font renderer places them correctly on screen, but raw text extraction
 * yields the Latin/ASCII codepoints.
 *
 * Two problems to fix:
 *  1. Glyph substitution  → replace each codepoint with its Bengali equivalent
 *  2. Pre-matra reordering → ি (i-matra), ে (e-matra), ৈ (oi-matra) are stored
 *     BEFORE their consonant in the byte stream but must come AFTER in Unicode.
 *
 * Usage:
 *   const { SUTONNY_MAP, PRE_MATRAS } = require('./sutonnyMJMap');
 */

// Characters that must be moved AFTER their following consonant cluster.
const PRE_MATRAS = new Set([
  '\u09BF', // ি  (i-matra)
  '\u09C7', // ে  (e-matra)
  '\u09C8', // ৈ  (oi-matra)
]);

/**
 * Complete SutonnyMJ → Unicode mapping.
 * Keys are the raw codepoints extracted from legacy-font PDFs.
 * Values are the correct Unicode Bengali string.
 *
 * This map covers:
 *  - Latin Extended range (U+00C0–U+024F) — matras, conjuncts, special chars
 *  - Specific ASCII characters that EC fonts map to Bengali glyphs
 *  - Control range (U+0080–U+00BF) used by some EC font variants
 */
const SUTONNY_MAP = {
  // ── Pre-matras (stored before consonant in legacy font) ─────────────────
  '\u00CF': '\u09C7', // Ï → ে  [PRE-MATRA]
  '\u00CE': '\u09C7', // Î → ে  [PRE-MATRA]
  '\u0118': '\u09C7', // Ę → ে  [PRE-MATRA]
  '\u0132': '\u09C7', // Ĳ → ে  [PRE-MATRA]
  '\u0133': '\u09C7', // ĳ → ে  [PRE-MATRA]
  '\u0102': '\u09BF', // Ă → ি  [PRE-MATRA]
  '\u0103': '\u09BF', // ă → ি  [PRE-MATRA]
  '\u01D0': '\u09BF', // ǐ → ি  [PRE-MATRA]
  '\u0119': '\u09C8', // ę → ৈ  [PRE-MATRA]

  // ── Post-matras / vowel signs (stored after consonant — no reorder needed)
  '\u0192': '\u09C1', // ƒ → ু  (u-matra)
  '\u0191': '\u09C2', // Ƒ → ূ  (uu-matra)
  '\u016A': '\u09C2', // Ū → ূ
  '\u016B': '\u09C1', // ū → ু
  '\u016C': '\u09C1', // Ŭ → ু
  '\u016D': '\u09C1', // ŭ → ু
  '\u016E': '\u09C1', // Ů → ু
  '\u016F': '\u09C2', // ů → ূ
  '\u0152': '\u09C1', // Œ → ু
  '\u0153': '\u09C1', // œ → ু
  '\u011A': '\u09CC', // Ě → ৌ  (ou-matra)
  '\u011B': '\u09CB', // ě → ো
  '\u0130': '\u09CB', // İ → ো
  '\u0104': '\u09CB', // Ą → ো
  '\u0105': '\u09CB', // ą → ো
  '\u01D2': '\u09CB', // ǒ → ো

  // ── া (aa-matra) — sometimes encoded separately ────────────────────────
  '\u00E0': '\u09BE', // à → া

  // ── ঃ ঁ ং ─────────────────────────────────────────────────────────────
  '\u0026': '\u0983', // & → ঃ  (visarga)
  '\u0027': '\u0981', // ' → ঁ  (chandrabindu)
  '\u0060': '\u0982', // ` → ং  (anusvara)

  // ── Hasanta (virama) ────────────────────────────────────────────────────
  '\u0100': '\u09CD', // Ā → ্  (hasanta)
  '\u0101': '\u09CD', // ā → ্

  // ── Bengali danda / double danda ────────────────────────────────────────
  '\u0021': '\u0964', // ! → ।
  '\u007C': '\u0965', // | → ॥

  // ── Independent vowels ─────────────────────────────────────────────────
  '\u0128': '\u0987', // Ĩ → ই
  '\u0129': '\u0987', // ĩ → ই
  '\u012A': '\u0988', // Ī → ঈ  (NOTE: also mapped to ট্র conjunct below — context-dependent)
  '\u012B': '\u0988', // ī → ঈ

  // ── Consonants (single) ─────────────────────────────────────────────────
  '\u0122': '\u0997', // Ģ → গ
  '\u0174': '\u09AC', // Ŵ → ব
  '\u0175': '\u09AC', // ŵ → ব
  '\u0162': '\u09A4', // Ţ → ত
  '\u0163': '\u09A4', // ţ → ত
  '\u0166': '\u09A5', // Ŧ → থ
  '\u0167': '\u09A5', // ŧ → থ
  '\u0160': '\u09B7', // Š → ষ
  '\u0161': '\u09B7', // š → ষ
  '\u015E': '\u09B6', // Ş → শ
  '\u015F': '\u09B6', // ş → শ
  '\u0106': '\u099A', // Ć → চ
  '\u0107': '\u099A', // ć → চ
  '\u010C': '\u099A', // Č → চ
  '\u010D': '\u099A', // č → চ
  '\u0110': '\u09A6', // Đ → দ
  '\u0111': '\u09A6', // đ → দ
  '\u0158': '\u09B0', // Ř → র
  '\u0159': '\u09B0', // ř → র
  '\u0179': '\u09AF', // Ź → য
  '\u017A': '\u09AF', // ź → য
  '\u017B': '\u09AF', // Ż → য
  '\u017D': '\u099C', // Ž → জ
  '\u017E': '\u099C', // ž → জ

  // ── Additional consonants from EC fonts ─────────────────────────────────
  '\u0181': '\u09B0', // Ɓ → র  (EC-specific variant for রু/রূ combinations)

  // ── Reph (র্) and ra-phala (্র) ────────────────────────────────────────
  '\u0154': '\u09B0\u09CD', // Ŕ → র্  (reph — goes before cluster, handled separately)
  '\u0155': '\u09B0\u09CD', // ŕ → র্
  '\u0178': '\u09B0\u09CD', // Ÿ → র্
  '\u00D7': '\u09CD\u09B0', // × → ্র  (ra-phala)
  '\u00F7': '\u09CD\u09B0', // ÷ → ্র
  '\u0141': '\u09CD\u09AF', // Ł → ্য  (ya-phala)
  '\u0142': '\u09CD\u09AF', // ł → ্য

  // ── ক্ষ ─────────────────────────────────────────────────────────────────
  '\u00B6': '\u0995\u09CD\u09B7', // ¶ → ক্ষ
  '\u00D9': '\u0995\u09CD\u09B7', // Ù → ক্ষ
  '\u0136': '\u0995\u09CD\u09B7', // Ķ → ক্ষ
  '\u0137': '\u0995\u09CD\u09B7', // ķ → ক্ষ

  // ── জ্ঞ ─────────────────────────────────────────────────────────────────
  '\u0126': '\u099C\u09CD\u099E', // Ħ → জ্ঞ
  '\u0134': '\u099C\u09CD\u099E', // Ĵ → জ্ঞ  (also used for প্র in EC fonts)

  // ── Common conjuncts ────────────────────────────────────────────────────
  '\u00CB': '\u09CD\u09AF',       // Ë → ্য  (ya-phala — common in EC PDFs)
  '\u00D4': '\u09A4\u09CD\u09A4', // Ô → ত্ত
  '\u0164': '\u09A4\u09CD\u09A4', // Ť → ত্ত
  '\u0168': '\u09B8\u09CD\u099F', // Ũ → স্ট
  '\u0169': '\u09B8\u09CD\u099F', // ũ → স্ট
  '\u00DF': '\u09B8\u09CD\u099F', // ß → স্ট
  '\u0165': '\u09B8\u09CD\u0995', // ť → স্ক
  '\u0138': '\u09B8\u09CD\u09AC', // ĸ → স্ব
  '\u013F': '\u09B8\u09CD\u09AA', // Ŀ → স্প
  '\u0140': '\u09B8\u09CD\u09AA', // ŀ → স্প
  '\u00C5': '\u09AA\u09CD\u09B0', // Å → প্র
  '\u00E5': '\u09AA\u09CD\u09B0', // å → প্র
  '\u0150': '\u09AA\u09CD\u09B0', // Ő → প্র
  '\u0151': '\u09AA\u09CD\u09B0', // ő → প্র
  '\u0131': '\u09AA\u09CD\u09B2', // ı → প্ল
  '\u0114': '\u09A4\u09CD\u09B0', // Ĕ → ত্র
  '\u0115': '\u09A4\u09CD\u09B0', // ĕ → ত্র
  '\u015C': '\u09B6\u09CD\u099A', // Ŝ → শ্চ
  '\u015A': '\u09B6\u09CD\u09AC', // Ś → শ্ব
  '\u015B': '\u09B6\u09CD\u09AC', // ś → শ্ব
  '\u0149': '\u09B6\u09CD\u09AC', // ŉ → শ্ব
  '\u00D0': '\u09A6\u09CD\u09A7', // Ð → দ্ধ
  '\u00F0': '\u09A6\u09CD\u09A7', // ð → দ্ধ
  '\u0127': '\u09A8\u09CD\u09A6\u09CD\u09B0', // ħ → ন্দ্র
  '\u0147': '\u09A8\u09CD\u09A4', // Ň → ন্ত
  '\u0148': '\u09A8\u09CD\u09A4', // ň → ন্ত
  '\u0145': '\u09A8\u09CD\u09A6', // Ņ → ন্দ
  '\u0146': '\u09A8\u09CD\u09A6', // ņ → ন্দ
  '\u013D': '\u09A4\u09CD\u09A8', // Ľ → ত্ন
  '\u013E': '\u09A4\u09CD\u09A8', // ľ → ত্ন
  '\u0143': '\u09A3\u09CD\u09A1', // Ń → ণ্ড
  '\u0144': '\u09A3\u09CD\u09A1', // ń → ণ্ড
  '\u008C': '\u09A3\u09CD',       // \x8C → ণ্
  '\u012F': '\u09AE\u09CD\u09AD', // į → ম্ভ
  '\u012E': '\u09AE\u09CD\u09AD', // Į → ম্ভ
  '\u00C6': '\u09AE\u09CD\u09AA', // Æ → ম্প
  '\u00E6': '\u09AE\u09CD\u09AA', // æ → ম্প
  '\u00F8': '\u0997\u09CD\u09B2', // ø → গ্ল
  '\u00D8': '\u0997\u09CD\u09B2', // Ø → গ্ল
  '\u014A': '\u0999\u09CD\u0995', // Ŋ → ঙ্ক
  '\u014B': '\u0999\u09CD\u0995', // ŋ → ঙ্ক
  '\u00DE': '\u09A4\u09CD\u09AC', // Þ → ত্ব
  '\u00FE': '\u09A4\u09CD\u09AC', // þ → ত্ব
  '\u015D': '\u09B7\u09CD\u09A3', // ŝ → ষ্ণ
  '\u013B': '\u09B2\u09CD\u09B2', // Ļ → ল্ল
  '\u013C': '\u09B2\u09CD\u09B2', // ļ → ল্ল
  '\u014C': '\u09AC\u09CD\u09A6', // Ō → ব্দ
  '\u014D': '\u09AC\u09CD\u09A6', // ō → ব্দ
  '\u0170': '\u09AC\u09CD\u09B0', // Ű → ব্র
  '\u0171': '\u09AC\u09CD\u09B0', // ű → ব্র
  '\u0172': '\u0995\u09CD\u09B0', // Ų → ক্র
  '\u0173': '\u0995\u09CD\u09B0', // ų → ক্র
  '\u0156': '\u09B0\u09CD\u09A4', // Ŗ → র্ত
  '\u0157': '\u09B0\u09CD\u09A4', // ŗ → র্ত
  '\u0135': '\u099C\u09CD\u09AC', // ĵ → জ্ব
  '\u0124': '\u09B9\u09CD\u09A8', // Ĥ → হ্ন
  '\u0125': '\u09B9\u09CD\u09B2', // ĥ → হ্ল
  '\u0176': '\u09AF\u09CD\u09AF', // Ŷ → য্য

  // ── Additional EC-specific conjuncts ────────────────────────────────────
  '\u0120': '\u0997\u09CD\u09A7', // Ġ → গ্ধ
  '\u0121': '\u0997\u09CD\u09A8', // ġ → গ্ন
  '\u010E': '\u099B',             // Ď → ছ
  '\u010F': '\u099B',             // ď → ছ
  '\u0112': '\u09A6\u09CD\u09AC', // Ē → দ্ব
  '\u0113': '\u09A6\u09CD\u09AC', // ē → দ্ব
  '\u0116': '\u09A8\u09CD\u09A8', // Ė → ন্ন
  '\u0117': '\u09A8\u09CD\u09A8', // ė → ন্ন
  '\u011C': '\u09A8\u09CD\u09A5', // Ĝ → ন্থ
  '\u011D': '\u09A8\u09CD\u09A5', // ĝ → ন্থ
  '\u011E': '\u09AE\u09CD\u09AE', // Ğ → ম্ম
  '\u011F': '\u09AE\u09CD\u09AE', // ğ → ম্ম
  '\u013A': '\u09B2\u09CD\u09AA', // ĺ → ল্প
  '\u0139': '\u09B2\u09CD\u0995', // Ĺ → ল্ক
  '\u014E': '\u09B9\u09CD\u09AE', // Ŏ → হ্ম
  '\u014F': '\u09B9\u09CD\u09AE', // ŏ → হ্ম
  '\u0177': '\u09AF\u09CD',       // ŷ → য্

  // ── Combined consonant+vowel glyphs (single codepoint in font) ──────────
  '\u01A3': '\u0995\u09C1',       // ƣ → কু
  '\u01A2': '\u0997\u09C1',       // Ƣ → গু
  '\u012D': '\u09DC',             // ĭ → ড়
  '\u012C': '\u09DD',             // Ĭ → ঢ়

  // ── EC-specific: additional Latin Extended mappings found in voter PDFs ──
  '\u00C0': '\u09CD\u09A4',       // À → ্ত
  '\u00C1': '\u09CD\u09A6',       // Á → ্দ
  '\u00C2': '\u09CD\u09A8',       // Â → ্ন
  '\u00C3': '\u09CD\u09AC',       // Ã → ্ব
  '\u00C4': '\u09CD\u09AE',       // Ä → ্ম
  '\u00C7': '\u09CD\u09B2',       // Ç → ্ল
  '\u00C8': '\u09CD\u09B8',       // È → ্স
  '\u00C9': '\u09CD\u099A',       // É → ্চ
  '\u00CA': '\u09CD\u099C',       // Ê → ্জ
  '\u00CC': '\u09CD\u09A1',       // Ì → ্ড
  '\u00CD': '\u09CD\u099F',       // Í → ্ট
  '\u00D1': '\u09CD\u09A2',       // Ñ → ্ঢ
  '\u00D2': '\u09CD\u09A3',       // Ò → ্ণ
  '\u00D3': '\u09CD\u09A5',       // Ó → ্থ
  '\u00D5': '\u09CD\u09A7',       // Õ → ্ধ
  '\u00D6': '\u09CD\u09AA',       // Ö → ্প
  '\u00DA': '\u09CD\u09AB',       // Ú → ্ফ
  '\u00DB': '\u09CD\u09AD',       // Û → ্ভ
  '\u00DC': '\u09CD\u09B7',       // Ü → ্ষ
  '\u00DD': '\u09CD\u09B6',       // Ý → ্শ
  '\u00E1': '\u09CD\u0995',       // á → ্ক
  '\u00E2': '\u09CD\u0996',       // â → ্খ
  '\u00E3': '\u09CD\u0997',       // ã → ্গ
  '\u00E4': '\u09CD\u0998',       // ä → ্ঘ
  '\u00E7': '\u09CD\u099E',       // ç → ্ঞ
  '\u00E8': '\u09CD\u099B',       // è → ্ছ
  '\u00E9': '\u09CD\u099D',       // é → ্ঝ
  '\u00EA': '\u09CD\u09A0',       // ê → ্ঠ
  '\u00EB': '\u09CD\u09B9',       // ë → ্হ
  '\u00EC': '\u09C3',             // ì → ৃ  (ri-matra)
  '\u00ED': '\u09C4',             // í → ৄ  (rri-matra)
  '\u00EE': '\u0985',             // î → অ
  '\u00EF': '\u0986',             // ï → আ
  '\u00F1': '\u098B',             // ñ → ঋ
  '\u00F2': '\u098C',             // ò → ঌ
  '\u00F3': '\u098F',             // ó → এ
  '\u00F4': '\u0990',             // ô → ঐ
  '\u00F5': '\u0993',             // õ → ও
  '\u00F6': '\u0994',             // ö → ঔ
  '\u00F9': '\u09CE',             // ù → ৎ (khanda ta)
  '\u00FA': '\u09F0',             // ú → র (Assamese ra)
  '\u00FB': '\u09F1',             // û → ৱ (Assamese wa)
  '\u00FC': '\u09BC',             // ü → ় (nukta)
  '\u00FD': '\u09D7',             // ý → ৗ  (au-length mark)
  '\u00FF': '\u09BE',             // ÿ → া  (aa-matra variant)

  // ── Control range used by some EC font variants ─────────────────────────
  '\u0080': '\u0995',             // → ক  (EC-specific)
  '\u0081': '\u0996',             // → খ
  '\u0082': '\u0997',             // → গ
  '\u0083': '\u0998',             // → ঘ
  '\u0084': '\u0999',             // → ঙ
  '\u0085': '\u099A',             // → চ
  '\u0086': '\u099B',             // → ছ
  '\u0087': '\u099C',             // → জ
  '\u0088': '\u099D',             // → ঝ
  '\u0089': '\u099E',             // → ঞ
  '\u008A': '\u099F',             // → ট
  '\u008B': '\u09A0',             // → ঠ
  // '\u008C': '\u09A3\u09CD',    // already defined above (ণ্)
  '\u008D': '\u09A1',             // → ড
  '\u008E': '\u09A2',             // → ঢ
  '\u008F': '\u09A3',             // → ণ
  '\u0090': '\u09A4',             // → ত
  '\u0091': '\u09A5',             // → থ
  '\u0092': '\u09A6',             // → দ
  '\u0093': '\u09A7',             // → ধ
  '\u0094': '\u09A8',             // → ন
  '\u0095': '\u09AA',             // → প
  '\u0096': '\u09AB',             // → ফ
  '\u0097': '\u09AC',             // → ব
  '\u0098': '\u09AD',             // → ভ
  '\u0099': '\u09AE',             // → ম
  '\u009A': '\u09AF',             // → য
  '\u009B': '\u09B0',             // → র
  '\u009C': '\u09B2',             // → ল
  '\u009D': '\u09B6',             // → শ
  '\u009E': '\u09B7',             // → ষ
  '\u009F': '\u09B8',             // → স
  '\u00A0': '\u09B9',             // → হ
  '\u00A1': '\u09DC',             // → ড়
  '\u00A2': '\u09DD',             // → ঢ়
  '\u00A3': '\u09DF',             // → য়
  '\u00A4': '\u09BE',             // → া
  '\u00A5': '\u09BF',             // → ি  [PRE-MATRA]
  '\u00A6': '\u09C0',             // → ী
  '\u00A7': '\u09C1',             // → ু
  '\u00A8': '\u09C2',             // → ূ
  '\u00A9': '\u09C3',             // → ৃ
  '\u00AA': '\u09C7',             // → ে  [PRE-MATRA]
  '\u00AB': '\u09C8',             // → ৈ  [PRE-MATRA]
  '\u00AC': '\u09CB',             // → ো
  '\u00AD': '\u09CC',             // → ৌ
  '\u00AE': '\u09CD',             // → ্  (hasanta)
  '\u00AF': '\u0982',             // → ং
  '\u00B0': '\u0983',             // → ঃ
  '\u00B1': '\u0981',             // → ঁ
  '\u00B2': '\u0985',             // → অ
  '\u00B3': '\u0986',             // → আ
  '\u00B4': '\u0987',             // → ই
  '\u00B5': '\u0988',             // → ঈ
  // '\u00B6': already mapped (ক্ষ)
  '\u00B7': '\u098A',             // → ঊ
  '\u00B8': '\u098B',             // → ঋ
  '\u00B9': '\u098F',             // → এ
  '\u00BA': '\u0990',             // → ঐ
  '\u00BB': '\u0993',             // → ও
  '\u00BC': '\u0994',             // → ঔ
  '\u00BD': '\u0989',             // → উ
  '\u00BE': '\u09CE',             // → ৎ
  '\u00BF': '\u0964',             // → ।
};

module.exports = { SUTONNY_MAP, PRE_MATRAS };
