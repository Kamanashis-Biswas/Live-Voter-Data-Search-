'use strict';

/**
 * reparsePdfs.js — Migration script
 *
 * Re-processes all previously uploaded PDFs with the new Unicode-correct parser,
 * replaces corrupted voter records in db.json with clean Unicode Bengali data.
 *
 * Usage:
 *   node backend/scripts/reparsePdfs.js
 *
 * Options:
 *   --dry-run      Show what would happen without writing to DB
 *   --pdf-id=xxx   Re-parse only a specific PDF by ID
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

const { parsePdfBuffer } = require('../services/pdfParserService');

// ── CLI arguments ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const targetPdfId = (args.find(a => a.startsWith('--pdf-id=')) || '').replace('--pdf-id=', '');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, { encoding: 'utf8' }));
  } catch {
    return { voters: [], pdfs: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Bengali PDF Re-parse Migration Script                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE — no changes will be written to db.json\n');
  }

  const db = readDb();

  if (!isDryRun && fs.existsSync(DB_PATH)) {
    const backupPath = `${DB_PATH}.bak`;
    try {
      fs.copyFileSync(DB_PATH, backupPath);
      console.log(`💾 Created database backup at: ${backupPath}\n`);
    } catch (err) {
      console.warn(`⚠️  Failed to create database backup: ${err.message}\n`);
    }
  }

  let pdfsToProcess = db.pdfs || [];

  if (targetPdfId) {
    pdfsToProcess = pdfsToProcess.filter(p => p.id === targetPdfId);
    if (pdfsToProcess.length === 0) {
      console.error(`❌ No PDF found with id: ${targetPdfId}`);
      process.exit(1);
    }
  }

  console.log(`📄 Found ${pdfsToProcess.length} PDF(s) to re-process`);
  console.log(`👥 Current voter count: ${(db.voters || []).length}\n`);

  let totalNewVoters = 0;
  let successCount = 0;
  let errorCount = 0;

  // Process PDFs one at a time to avoid OOM
  for (let idx = 0; idx < pdfsToProcess.length; idx++) {
    const pdfRecord = pdfsToProcess[idx];
    const safeFileName = pdfRecord.safeFileName || `${pdfRecord.id}.pdf`;
    const filePath = path.join(UPLOADS_DIR, safeFileName);

    console.log(`\n┌─ [${idx + 1}/${pdfsToProcess.length}] Processing: ${pdfRecord.fileName || safeFileName}`);
    console.log(`│  ID: ${pdfRecord.id}`);

    if (!fs.existsSync(filePath)) {
      console.log(`│  ❌ File not found: ${filePath}`);
      console.log(`└─ Skipping\n`);
      errorCount++;
      continue;
    }

    const startTime = Date.now();

    try {
      const buffer = fs.readFileSync(filePath);
      const result = await parsePdfBuffer(buffer, pdfRecord.id, pdfRecord.fileName || safeFileName);

      const duration = Date.now() - startTime;
      console.log(`│  ✅ Extracted ${result.voters.length} voters in ${formatDuration(duration)}`);
      console.log(`│  Type: ${result.pdfType} | Encoding: ${result.encoding}`);
      console.log(`│  Pages: ${result.totalPages}`);

      if (result.warning) {
        console.log(`│  ⚠️  ${result.warning}`);
      }

      // Show sample of first voter to verify quality
      if (result.voters.length > 0) {
        const v = result.voters[0];
        console.log(`│  Sample voter: ${v.nameBn} | পিতা: ${v.fatherName}`);
      }

      if (!isDryRun) {
        // Remove old voters for this PDF and insert new ones
        db.voters = (db.voters || []).filter(v => v.pdfUploadId !== pdfRecord.id);
        db.voters = [...db.voters, ...result.voters];

        // Update PDF record with new stats
        const pdfIdx = db.pdfs.findIndex(p => p.id === pdfRecord.id);
        if (pdfIdx !== -1) {
          db.pdfs[pdfIdx] = {
            ...db.pdfs[pdfIdx],
            voterCount: result.voters.length,
            totalPages: result.totalPages,
            pdfType: result.pdfType,
            encoding: result.encoding,
            lastReparsed: new Date().toISOString(),
            district: result.coverMeta.district || db.pdfs[pdfIdx].district,
            upazila: result.coverMeta.upazila || db.pdfs[pdfIdx].upazila,
            unionName: result.coverMeta.unionName || db.pdfs[pdfIdx].unionName,
            wardNo: result.coverMeta.wardNo || db.pdfs[pdfIdx].wardNo,
            voterArea: result.coverMeta.voterArea || db.pdfs[pdfIdx].voterArea,
            totalVoters: result.coverMeta.totalVoters || db.pdfs[pdfIdx].totalVoters,
          };
        }

        // Write after each PDF (safe against partial failure)
        writeDb(db);
        console.log(`│  💾 Saved to db.json`);
      }

      totalNewVoters += result.voters.length;
      successCount++;
    } catch (err) {
      console.log(`│  ❌ Error: ${err.message}`);
      errorCount++;
    }

    console.log(`└─ Done`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        Summary                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  ✅ Success : ${successCount} PDF(s)`);
  console.log(`  ❌ Errors  : ${errorCount} PDF(s)`);
  console.log(`  👥 Voters  : ${totalNewVoters} (new total)`);
  if (isDryRun) {
    console.log(`\n  ℹ️  Dry run — run without --dry-run to apply changes`);
  }
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
