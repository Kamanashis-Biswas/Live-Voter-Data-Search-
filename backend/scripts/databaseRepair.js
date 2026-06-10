'use strict';

/**
 * databaseRepair.js — Database Repair & Correction Script
 *
 * Scans all existing voter records in db.json and applies the full
 * Bengali correction pipeline to fix corrupted text:
 *   1. Dictionary correction (word-level fixes)
 *   2. Name correction (fuzzy/phonetic person name fixes)
 *   3. District/Upazila validation (geographic field fixes)
 *   4. Search index rebuild
 *
 * Usage:
 *   node backend/scripts/databaseRepair.js
 *
 * Options:
 *   --dry-run        Show what would change without writing
 *   --verbose        Show every correction detail
 *   --limit=N        Process only first N voters
 *
 * @author Kamanashis Biswas
 * @version 7.0.0
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const BACKUP_PATH = DB_PATH + '.pre-repair.bak';

const { correctText } = require('../utils/dictionaryCorrector');
const { correctName } = require('../utils/nameCorrector');
const { validateAddress } = require('../utils/districtValidator');
const { normalizeForSearch } = require('../utils/bengaliUnicodeConverter');

// ── CLI arguments ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.replace('--limit=', '')) : 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Bengali Database Repair Script v7.0.0                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE — no changes will be written\n');
  }

  const db = readDb();
  const voters = db.voters || [];
  const totalVoters = voters.length;

  console.log(`📊 Database stats:`);
  console.log(`   Voters: ${totalVoters}`);
  console.log(`   PDFs:   ${(db.pdfs || []).length}\n`);

  if (totalVoters === 0) {
    console.log('ℹ️  No voters to repair.');
    return;
  }

  // Create backup before repair
  if (!isDryRun) {
    try {
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
      console.log(`💾 Backup created: ${BACKUP_PATH}\n`);
    } catch (err) {
      console.warn(`⚠️  Failed to create backup: ${err.message}\n`);
    }
  }

  const processLimit = limit > 0 ? Math.min(limit, totalVoters) : totalVoters;
  console.log(`🔧 Processing ${processLimit} of ${totalVoters} voters...\n`);

  const startTime = Date.now();

  // Correction statistics
  let stats = {
    votersProcessed: 0,
    votersModified: 0,
    dictCorrections: 0,
    nameCorrections: 0,
    geoCorrections: 0,
    totalFieldCorrections: 0,
    correctionDetails: [],
  };

  for (let i = 0; i < processLimit; i++) {
    const voter = voters[i];
    let voterModified = false;
    const voterCorrections = [];

    // 1. Dictionary correction on text fields
    const textFields = ['nameBn', 'fatherName', 'motherName', 'occupation', 'address'];
    for (const field of textFields) {
      if (voter[field] && voter[field].length > 0) {
        const result = correctText(voter[field]);
        if (result.correctionCount > 0) {
          if (isVerbose) {
            voterCorrections.push(`  [DICT] ${field}: "${voter[field]}" → "${result.corrected}"`);
          }
          if (!isDryRun) {
            voter[field] = result.corrected;
          }
          stats.dictCorrections += result.correctionCount;
          stats.totalFieldCorrections += result.correctionCount;
          voterModified = true;
        }
      }
    }

    // 2. Name correction on person name fields
    const nameFields = ['nameBn', 'fatherName', 'motherName'];
    for (const field of nameFields) {
      const currentValue = isDryRun ? voter[field] : voter[field]; // after dict correction
      if (currentValue && currentValue.length > 1) {
        const result = correctName(currentValue, 0.80);
        if (result.corrections && result.corrections.length > 0) {
          if (isVerbose) {
            for (const c of result.corrections) {
              voterCorrections.push(`  [NAME] ${field}: "${c.from}" → "${c.to}" (${c.method}, ${(c.confidence * 100).toFixed(0)}%)`);
            }
          }
          if (!isDryRun) {
            voter[field] = result.corrected;
          }
          stats.nameCorrections += result.corrections.length;
          stats.totalFieldCorrections += result.corrections.length;
          voterModified = true;
        }
      }
    }

    // 3. Geographic field correction
    if (voter.district || voter.upazila) {
      const addrResult = validateAddress({
        district: voter.district,
        upazila: voter.upazila,
      });
      if (addrResult.corrected) {
        if (addrResult.corrected.district && addrResult.corrected.district !== voter.district) {
          if (isVerbose) {
            voterCorrections.push(`  [GEO] district: "${voter.district}" → "${addrResult.corrected.district}"`);
          }
          if (!isDryRun) {
            voter.district = addrResult.corrected.district;
          }
          stats.geoCorrections++;
          stats.totalFieldCorrections++;
          voterModified = true;
        }
        if (addrResult.corrected.upazila && addrResult.corrected.upazila !== voter.upazila) {
          if (isVerbose) {
            voterCorrections.push(`  [GEO] upazila: "${voter.upazila}" → "${addrResult.corrected.upazila}"`);
          }
          if (!isDryRun) {
            voter.upazila = addrResult.corrected.upazila;
          }
          stats.geoCorrections++;
          stats.totalFieldCorrections++;
          voterModified = true;
        }
      }
    }

    if (voterModified) {
      stats.votersModified++;
      if (isVerbose && voterCorrections.length > 0) {
        console.log(`\n  Voter #${i + 1} (${voter.serialNo || voter.id}):`);
        for (const line of voterCorrections) {
          console.log(line);
        }
      }
    }

    stats.votersProcessed++;

    // Progress indicator every 500 voters
    if (stats.votersProcessed % 500 === 0) {
      const pct = ((stats.votersProcessed / processLimit) * 100).toFixed(0);
      process.stdout.write(`  ⏳ Progress: ${stats.votersProcessed}/${processLimit} (${pct}%) — ${stats.totalFieldCorrections} corrections so far\r`);
    }
  }

  console.log(''); // Clear progress line

  // 4. Rebuild search indexes on corrected data
  if (!isDryRun) {
    console.log('\n🔍 Rebuilding search indexes...');
    for (const voter of voters) {
      voter.normalName = voter.nameBn ? normalizeForSearch(voter.nameBn).toLowerCase() : '';
      voter.normalFather = voter.fatherName ? normalizeForSearch(voter.fatherName).toLowerCase() : '';
      voter.normalMother = voter.motherName ? normalizeForSearch(voter.motherName).toLowerCase() : '';
      voter.normalVillage = voter.village ? normalizeForSearch(voter.village).toLowerCase() : '';
      voter.normalVoterArea = voter.voterArea ? normalizeForSearch(voter.voterArea).toLowerCase() : '';
      voter.normalUpazila = voter.upazila ? normalizeForSearch(voter.upazila).toLowerCase() : '';
      voter.normalDistrict = voter.district ? normalizeForSearch(voter.district).toLowerCase() : '';
      voter.normalOccupation = voter.occupation ? normalizeForSearch(voter.occupation).toLowerCase() : '';
    }

    // 5. Save repaired database
    console.log('💾 Saving repaired database...');
    writeDb(db);
    console.log('✅ Database saved successfully.');
  }

  const duration = Date.now() - startTime;

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Repair Summary                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  📋 Voters Processed  : ${stats.votersProcessed}`);
  console.log(`  ✏️  Voters Modified   : ${stats.votersModified} (${((stats.votersModified / stats.votersProcessed) * 100).toFixed(1)}%)`);
  console.log(`  📖 Dict Corrections  : ${stats.dictCorrections}`);
  console.log(`  👤 Name Corrections  : ${stats.nameCorrections}`);
  console.log(`  🗺️  Geo Corrections   : ${stats.geoCorrections}`);
  console.log(`  📊 Total Corrections : ${stats.totalFieldCorrections}`);
  console.log(`  ⏱️  Duration          : ${formatDuration(duration)}`);
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
