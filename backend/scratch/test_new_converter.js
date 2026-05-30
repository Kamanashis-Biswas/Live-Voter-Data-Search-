'use strict';

const fs = require('fs');
const path = require('path');
const { SUTONNY_MAP } = require('c:/Users/kaman/Desktop/Live Voter Data Search/backend/utils/sutonnyMJMap.js');

const PRE_MATRA_CP = new Set([0x09BF, 0x09C7, 0x09C8]); // ি ে ৈ
const SUTONNY_PRE_MATRA_SOURCES = new Set(
  Object.entries(SUTONNY_MAP)
    .filter(([, v]) => PRE_MATRA_CP.has(v.codePointAt(0)))
    .map(([k]) => k.codePointAt(0))
);

const SENTINEL = '\u0002';
const CONSONANT_RE = '[\u0995-\u09B9\u09DC-\u09DF\u09CE\u09F0-\u09F1]';
const HASANTA = '\u09CD';

const SENTINEL_CLUSTER_RE = new RegExp(
  SENTINEL + '([\u09BF\u09C7\u09C8])(' + CONSONANT_RE + '(?:' + HASANTA + CONSONANT_RE + ')*)',
  'gu'
);

function tagRawUnicodePreMatras(str) {
  if (!str) return '';
  // Tag only if NOT preceded by a consonant or hasanta
  const TAG_REGEX = /(?<![\u0995-\u09B9\u09DC-\u09DF\u09CE\u09F0-\u09F1\u09CD])([\u09BF\u09C7\u09C8])/g;
  return str.replace(TAG_REGEX, SENTINEL + '$1');
}

function applyGlyphMap(str, map, preSources) {
  let result = '';
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (map[char] !== undefined) {
      result += (preSources && preSources.has(cp) ? SENTINEL : '') + map[char];
    } else {
      result += char;
    }
  }
  return result;
}

function reorderSentinelPreMatras(str) {
  let result = str.replace(SENTINEL_CLUSTER_RE, (_match, matra, cluster) => cluster + matra);
  return result.replace(/\u0002/g, '');
}

function normalizeComplexMatras(str) {
  if (!str) return '';
  return str
    .replace(/\u09C7\u09BE/g, '\u09CB') // ে + া = ো
    .replace(/\u09C7\u09D7/g, '\u09CC') // ে + ৗ = ৌ
    .replace(/\u09C7\u09C7/g, '\u09C7') // double ে = ে
    .replace(/\u09BF\u09BF/g, '\u09BF') // double ি = ি
    .replace(/\u09CD\u09CD/g, '\u09CD'); // double hasanta
}

function fixECExtractionArtifacts(str) {
  if (!str) return '';
  let s = str;
  s = s.replace(/জহ্ল/g, 'জন্ম');
  s = s.replace(/জম্ভ/g, 'জন্ম');
  s = s.replace(/নণ্ডর/g, 'নম্বর');
  s = s.replace(/জ্ঞকাশ/g, 'প্রকাশ');
  s = s.replace(/সবেমোট/g, 'সর্বমোট');
  s = s.replace(/নিবোচন/g, 'নির্বাচন');
  s = s.replace(/কিমশন/g, 'কমিশন');
  s = s.replace(/\s{2,}/g, ' ');
  return s.trim();
}

function stripGarbage(str) {
  return str.replace(/[^\u0980-\u09FF\u0964-\u0965\u0030-\u0039\u0020\u002F\u002E\u002D\u002C\u0028\u0029\u003A\u003B]/g, '');
}

function convertSutonnyMJNew(raw) {
  if (!raw) return '';
  // 1. Tag raw Unicode pre-matras with sentinel first (using negative lookbehind)
  let s = tagRawUnicodePreMatras(raw);
  // 2. Apply legacy glyph mappings (which also tags legacy pre-matras with sentinel)
  s = applyGlyphMap(s, SUTONNY_MAP, SUTONNY_PRE_MATRA_SOURCES);
  // 3. Reorder all sentinel-tagged pre-matras in a single pass
  s = reorderSentinelPreMatras(s);
  // 4. Normalize e+a -> o, etc.
  s = normalizeComplexMatras(s);
  s = s.normalize('NFC');
  // 5. Apply EC PDF-specific artifact cleanups
  s = fixECExtractionArtifacts(s);
  // 6. Strip remaining non-Bengali garbage
  s = stripGarbage(s);
  return s.trim();
}

// Test with some samples
const samples = [
  "িনবÎাচন কিমশন", // raw extracted from PDF
  "Ïভাটার তািলকা - (পুƁষ)", // raw extracted from PDF
  "Ïজলা: বােগরহাট", // raw extracted from PDF
  "উপেজলা/থানা", // raw extracted from PDF
  "রোজিনা বেগম", // already correct Unicode
  "শেখ মোহাম্মদ", // already correct Unicode
  "নবেন্দু", // already correct Unicode
];

console.log("--- Conversion Results ---");
for (const sample of samples) {
  const converted = convertSutonnyMJNew(sample);
  console.log(`Raw: "${sample}" => Converted: "${converted}"`);
}
