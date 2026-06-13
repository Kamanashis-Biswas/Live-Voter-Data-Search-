const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbPath = path.join(__dirname, '../data/db.json');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env!');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function runGlobalReplace() {
  console.log('--- 1. Updating Local Database (db.json) ---');
  let dbContent = fs.readFileSync(dbPath, 'utf8');
  const localMatchCount = (dbContent.match(/আল্পুল/g) || []).length;
  
  if (localMatchCount > 0) {
    dbContent = dbContent.replace(/আল্পুল/g, 'আব্দুল');
    fs.writeFileSync(dbPath, dbContent, 'utf8');
    console.log(`✅ Local db.json updated: replaced "আল্পুল" -> "আব্দুল" (${localMatchCount} occurrences).`);
  } else {
    console.log('ℹ️ No occurrences of "আল্পুল" found in local db.json.');
  }

  console.log('\n--- 2. Connecting to Supabase Database ---');
  console.log('Database URL:', supabaseUrl);
  
  // Find all rows in Supabase where name_bn, father_name, or mother_name contains "আল্পুল"
  const { data: rows, error: fetchErr } = await supabaseAdmin
    .from('voters')
    .select('id, name_bn, father_name, mother_name')
    .or('name_bn.ilike.%আল্পুল%,father_name.ilike.%আল্পুল%,mother_name.ilike.%আল্পুল%');

  if (fetchErr) {
    console.error('❌ Error fetching rows from Supabase:', fetchErr.message);
    process.exit(1);
  }

  console.log(`📊 Found ${rows ? rows.length : 0} rows in Supabase containing "আল্পুল".`);

  if (rows && rows.length > 0) {
    let updateCount = 0;
    for (const row of rows) {
      const updates = {};
      
      if (row.name_bn && row.name_bn.includes('আল্পুল')) {
        updates.name_bn = row.name_bn.replace(/আল্পুল/g, 'আব্দুল');
      }
      if (row.father_name && row.father_name.includes('আল্পুল')) {
        updates.father_name = row.father_name.replace(/আল্পুল/g, 'আব্দুল');
      }
      if (row.mother_name && row.mother_name.includes('আল্পুল')) {
        updates.mother_name = row.mother_name.replace(/আল্পুল/g, 'আব্দুল');
      }

      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabaseAdmin
          .from('voters')
          .update(updates)
          .eq('id', row.id);

        if (updErr) {
          console.error(`❌ Error updating row ID ${row.id}:`, updErr.message);
        } else {
          updateCount += Object.keys(updates).length;
        }
      }
    }
    console.log(`✅ Supabase database updated: corrected ${updateCount} fields across ${rows.length} rows.`);
  }

  console.log('\n--- Global Database Correction Complete ---');
}

runGlobalReplace().catch(err => console.error('Unhandled script error:', err));
