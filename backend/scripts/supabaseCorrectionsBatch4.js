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

// Define replacements (source -> target) in order of execution
const replacements = [
  { from: 'আহন্তদ', to: 'আহম্মদ' },
  { from: 'ফিজলাতুন্নেছা', to: 'ফজিলাতুন্নেছা' },
  { from: 'রওব', to: 'রজ্জব' },
  { from: 'কন্নুস', to: 'কদ্দুস' },
  { from: 'উওল', to: 'উজ্জল' },
  { from: 'মোহন্তাদ', to: 'মোহম্মদ' }
];

async function runCorrections() {
  console.log('\n--- Connecting to Supabase Database ---');
  console.log('Database URL:', supabaseUrl);

  let totalFieldsUpdated = 0;
  let totalRowsChecked = 0;

  for (const r of replacements) {
    console.log(`\nChecking Supabase: "${r.from}" -> "${r.to}"`);
    
    // Find all rows containing the source term in name_bn, father_name, or mother_name
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from('voters')
      .select('id, name_bn, father_name, mother_name')
      .or(`name_bn.ilike.%${r.from}%,father_name.ilike.%${r.from}%,mother_name.ilike.%${r.from}%`);

    if (fetchErr) {
      console.error(`❌ Error fetching rows for "${r.from}":`, fetchErr.message);
      continue;
    }

    if (rows && rows.length > 0) {
      console.log(`   Found ${rows.length} rows containing "${r.from}". Updating...`);
      totalRowsChecked += rows.length;

      for (const row of rows) {
        const updates = {};
        const regex = new RegExp(r.from, 'g');

        if (row.name_bn && row.name_bn.includes(r.from)) {
          updates.name_bn = row.name_bn.replace(regex, r.to);
        }
        if (row.father_name && row.father_name.includes(r.from)) {
          updates.father_name = row.father_name.replace(regex, r.to);
        }
        if (row.mother_name && row.mother_name.includes(r.from)) {
          updates.mother_name = row.mother_name.replace(regex, r.to);
        }

        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await supabaseAdmin
            .from('voters')
            .update(updates)
            .eq('id', row.id);

          if (updErr) {
            console.error(`   ❌ Error updating row ID ${row.id}:`, updErr.message);
          } else {
            totalFieldsUpdated += Object.keys(updates).length;
          }
        }
      }
    } else {
      console.log(`   No rows found containing "${r.from}".`);
    }
  }

  console.log(`\n--- Supabase corrections completed. Total fields updated: ${totalFieldsUpdated} across ${totalRowsChecked} rows ---`);
}

runCorrections().catch(err => console.error('Unhandled script error:', err));
