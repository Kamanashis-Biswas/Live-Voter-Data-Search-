'use strict';

/**
 * databaseRepairWithGemini.js — AI-Powered Database Repair Script
 *
 * Scans all voter records in db.json and applies Gemini AI correction
 * to clean up OCR artifacts and spelling errors.
 *
 * Usage:
 *   node backend/scripts/databaseRepairWithGemini.js
 *
 * Options:
 *   --dry-run        Process and print output without writing to database
 *   --batchSize=N    Number of voters to process in each API request (default: 50)
 *   --limit=N        Total number of voters to process
 *
 * @version 1.0.0
 */

// Load dotenv to access GEMINI_API_KEY
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const BACKUP_PATH = DB_PATH + '.pre-ai-repair.bak';

const { isConfigured, correctVotersWithGemini } = require('../services/geminiService');
const { normalizeForSearch } = require('../utils/bengaliUnicodeConverter');

// ── CLI arguments ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.replace('--limit=', '')) : 0;
const batchArg = args.find(a => a.startsWith('--batchSize='));
const batchSize = batchArg ? parseInt(batchArg.replace('--batchSize=', '')) : 50;

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, { encoding: 'utf8' }));
  } catch {
    return { voters: [], pdfs: [] };
  }
}

function writeDb(data) {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8' });
  fs.renameSync(tmp, DB_PATH);
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Gemini AI Database Repair Script v1.0.0               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!isConfigured()) {
    console.error('❌ Error: GEMINI_API_KEY is not configured in backend/.env');
    console.log('Please add your key first:');
    console.log('GEMINI_API_KEY="your_api_key_here"\n');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE — no changes will be written\n');
  }

  const db = readDb();
  const voters = db.voters || [];
  const totalVoters = voters.length;

  console.log(`📊 Database Stats:`);
  console.log(`   Voters: ${totalVoters}`);
  console.log(`   PDFs:   ${(db.pdfs || []).length}\n`);

  if (totalVoters === 0) {
    console.log('ℹ️  No voters to repair.');
    return;
  }

  // Create backup before AI repair
  if (!isDryRun) {
    try {
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
      console.log(`💾 Backup created: ${BACKUP_PATH}\n`);
    } catch (err) {
      console.warn(`⚠️  Failed to create backup: ${err.message}\n`);
    }
  }

  const processLimit = limit > 0 ? Math.min(limit, totalVoters) : totalVoters;
  console.log(`🔧 Processing ${processLimit} voters in batches of ${batchSize}...\n`);

  const startTime = Date.now();
  let modifiedCount = 0;

  for (let startIdx = 0; startIdx < processLimit; startIdx += batchSize) {
    const endIdx = Math.min(startIdx + batchSize, processLimit);
    const batch = voters.slice(startIdx, endIdx);

    console.log(`📦 Batch [${startIdx + 1} - ${endIdx}] of ${processLimit}...`);
    
    // Save original values for comparison
    const originals = batch.map(v => ({ ...v }));

    // Send to Gemini
    const correctedBatch = await correctVotersWithGemini(batch);

    // Track modifications
    for (let i = 0; i < batch.length; i++) {
      const orig = originals[i];
      const corr = correctedBatch[i];

      const diffs = [];
      if (orig.nameBn !== corr.nameBn) diffs.push(`name: "${orig.nameBn}" → "${corr.nameBn}"`);
      if (orig.fatherName !== corr.fatherName) diffs.push(`father: "${orig.fatherName}" → "${corr.fatherName}"`);
      if (orig.motherName !== corr.motherName) diffs.push(`mother: "${orig.motherName}" → "${corr.motherName}"`);
      if (orig.occupation !== corr.occupation) diffs.push(`occ: "${orig.occupation}" → "${corr.occupation}"`);
      if (orig.address !== corr.address) diffs.push(`addr: "${orig.address}" → "${corr.address}"`);

      if (diffs.length > 0) {
        modifiedCount++;
        console.log(`  👤 Voter #${startIdx + i + 1} (${orig.serialNo || orig.id}):`);
        diffs.forEach(d => console.log(`    ${d}`));

        // Update main voter list
        if (!isDryRun) {
          const indexInDb = startIdx + i;
          voters[indexInDb] = {
            ...voters[indexInDb],
            nameBn: corr.nameBn,
            fatherName: corr.fatherName,
            motherName: corr.motherName,
            occupation: corr.occupation,
            address: corr.address,
            // Rebuild search indexes
            normalName: corr.nameBn ? normalizeForSearch(corr.nameBn).toLowerCase() : '',
            normalFather: corr.fatherName ? normalizeForSearch(corr.fatherName).toLowerCase() : '',
            normalMother: corr.motherName ? normalizeForSearch(corr.motherName).toLowerCase() : '',
            normalOccupation: corr.occupation ? normalizeForSearch(corr.occupation).toLowerCase() : '',
            normalVillage: corr.address ? normalizeForSearch(corr.address).toLowerCase() : ''
          };
        }
      }
    }
  }

  // Save repaired database
  if (!isDryRun && modifiedCount > 0) {
    console.log('\n💾 Saving repaired database...');
    writeDb(db);
    console.log('✅ Database saved successfully.');
  }

  const duration = Date.now() - startTime;
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                 AI Repair Summary                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  📋 Voters Processed : ${processLimit}`);
  console.log(`  ✏️  Voters Modified  : ${modifiedCount} (${((modifiedCount / processLimit) * 100).toFixed(1)}%)`);
  console.log(`  ⏱️  Duration         : ${((duration) / 1000).toFixed(1)}s`);
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
