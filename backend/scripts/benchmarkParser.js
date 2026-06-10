'use strict';

/**
 * @file benchmarkParser.js
 * @description Performance benchmarking script for the voter data processing pipeline.
 *
 * Benchmarks:
 *   - Encoding detection speed
 *   - Font conversion throughput
 *   - Dictionary correction performance
 *   - Name correction performance
 *   - Search normalization speed
 *   - Quality scoring speed
 *
 * Usage: node scripts/benchmarkParser.js
 *
 * @version 7.0.0 — Rewritten for consolidated architecture
 */

const { detectEncoding, convertSutonnyMJ, autoConvert, normalizeForSearch } = require('../utils/bengaliUnicodeConverter');
const { correctWord, correctText } = require('../utils/dictionaryCorrector');
const { correctName } = require('../utils/nameCorrector');
const { scoreVoterQuality } = require('../utils/bengaliUnicodeConverter');
const { quickMatch, buildVoterIndex, generateNgrams } = require('../utils/searchIndexer');

// ── Test Samples ─────────────────────────────────────────────────────────────

const SAMPLES = {
  unicodeBengali: 'নির্বাচন কমিশন ভোটার তালিকা জেলা বাগেরহাট উপজেলা রামপাল',
  corruptedNames: 'শখ মহমদ হসন বগম',
  sutonnyText: '\u00CF\u00CE\u0102\u0103\u0118',
};

function benchmark(name, fn, iterations = 1000) {
  const startMem = process.memoryUsage().heapUsed;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) { fn(); }

  const duration = Date.now() - startTime;
  const memUsed = (process.memoryUsage().heapUsed - startMem) / 1024 / 1024;

  console.log(`  ${name}`);
  console.log(`    ${iterations} iterations in ${duration}ms (${(duration/iterations).toFixed(3)}ms/op, ${(iterations/(duration/1000)).toFixed(0)} ops/sec, ${memUsed.toFixed(2)}MB)`);
  return { name, iterations, duration, avgMs: duration/iterations, memMB: memUsed };
}

function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PERFORMANCE BENCHMARKS v7.0.0');
  console.log('═'.repeat(60));

  console.log('\n📊 Encoding Detection:');
  benchmark('Detect Unicode', () => detectEncoding(SAMPLES.unicodeBengali), 10000);
  benchmark('Detect SutonnyMJ', () => detectEncoding(SAMPLES.sutonnyText), 10000);

  console.log('\n📊 Font Conversion:');
  benchmark('Convert SutonnyMJ (short)', () => convertSutonnyMJ(SAMPLES.sutonnyText), 5000);
  benchmark('AutoConvert Unicode', () => autoConvert(SAMPLES.unicodeBengali), 5000);

  console.log('\n📊 Dictionary Correction:');
  benchmark('correctWord (known)', () => correctWord('শখ'), 5000);
  benchmark('correctText (sentence)', () => correctText('কিমশন নিবাচন'), 2000);

  console.log('\n📊 Name Correction:');
  benchmark('correctName (single)', () => correctName('মোহামদ', 0.7), 1000);
  benchmark('correctName (full)', () => correctName('শখ মোহামদ হসন', 0.7), 500);

  console.log('\n📊 Search:');
  benchmark('normalizeForSearch', () => normalizeForSearch(SAMPLES.unicodeBengali), 10000);
  const stored = 'মোহাম্মদ হোসেন';
  const ns = normalizeForSearch(stored).toLowerCase();
  const q = 'মোহাম্মদ';
  const nq = normalizeForSearch(q).toLowerCase();
  benchmark('quickMatch', () => quickMatch(stored, ns, q, nq), 50000);
  benchmark('buildVoterIndex', () => buildVoterIndex({ nameBn: stored, fatherName: 'আব্দুল', motherName: '', village: 'ঢাকা', voterArea: '', upazila: '', district: 'ঢাকা', occupation: '' }), 5000);
  benchmark('generateNgrams', () => generateNgrams('মোহাম্মদহোসেন', 2), 10000);

  console.log('\n📊 Quality Scoring:');
  const voter = { nameBn: 'মোহাম্মদ', fatherName: 'আব্দুল', motherName: 'বেগম', voterNumber: '12345', nidNumber: '1234567890123', district: 'ঢাকা', upazila: 'সাভার', village: 'টেকা', wardNo: '১' };
  benchmark('scoreVoterQuality', () => scoreVoterQuality(voter), 10000);

  console.log('\n' + '═'.repeat(60));
  console.log('  Benchmark Complete');
  console.log('═'.repeat(60) + '\n');
}

main();
