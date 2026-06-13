const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env!');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// Define replacements (source -> target)
const replacements = [
  { from: 'শেখ আল্পুল হামিদ', to: 'শেখ আব্দুল হামিদ' },
  { from: 'মল্লিক ওসমান গিন', to: 'মল্লিক ওসমান গনি' },
  { from: 'শেখ দীন মোহান্তাদ', to: 'শেখ দীন মোহাম্মদ' },
  { from: 'শেখ ইউছ আলী', to: 'শেখ ইউনুছ আলী' },
  
  // Both regular and OCR-typo versions
  { from: 'সরদার আহন্তদ আলী', to: 'সরদার আহম্মদ আলী' },
  { from: 'সরত্নার আহন্তদ আলী', to: 'সরদার আহম্মদ আলী' },
  
  { from: 'খান শামছুন্নিন', to: 'খান শামছুদ্দিন' },
  { from: 'খঁান শামছুন্নিন', to: 'খান শামছুদ্দিন' },
  
  { from: 'শেখ র  মুহান্তদ', to: 'শেখ নুর মুহাম্মদ' },
  { from: 'শেখ র মুহান্তদ', to: 'শেখ নুর মুহাম্মদ' },
  
  { from: 'মেনায়ারা বেগম', to: 'মনোয়ারা বেগম' },
  { from: 'ভেলাকা ডাকুয়া', to: 'ভেলোকা ডাকুয়া' },
  
  { from: 'রামেলা রানী মণ্ডল', to: 'শ্যামেলা রানী মণ্ডল' },
  { from: 'রামেলা রিনা মণ্ডল', to: 'শ্যামেলা রানী মণ্ডল' },
  
  { from: 'শেখ মুসলিম উদ্দিন', to: 'শেখ মোছলেম উদ্দিন' },
  { from: 'রুশুল আমিনা শেখ', to: 'রুহুল আমিনা শেখ' },
  
  { from: 'সরদার আোাব উদ্দিন', to: 'সরদার আপ্তাব উদ্দিন' },
  { from: 'সরত্নার আোাব উদ্দিন', to: 'সরদার আপ্তাব উদ্দিন' },
  
  { from: 'শেখ ইিসৈ আলী', to: 'শেখ ইদ্রিস আলী' },
  { from: 'শেখ দুকুর আলী', to: 'শেখ শুকুর আলী' }
];

async function updateSupabase() {
  console.log('--- Connecting to Supabase ---');
  console.log('Database URL:', supabaseUrl);
  let totalUpdated = 0;
  
  for (const r of replacements) {
    console.log(`\nChecking: "${r.from}" -> "${r.to}"`);
    
    // Check name_bn
    const { data: nameMatches, error: nameErr } = await supabaseAdmin
      .from('voters')
      .select('id, name_bn')
      .eq('name_bn', r.from);
      
    if (nameErr) {
      console.error('Error fetching name_bn:', nameErr.message);
      continue;
    }
    
    if (nameMatches && nameMatches.length > 0) {
      console.log(`   Found ${nameMatches.length} matches in name_bn. Updating...`);
      for (const row of nameMatches) {
        const { error: updErr } = await supabaseAdmin
          .from('voters')
          .update({ name_bn: r.to })
          .eq('id', row.id);
        if (updErr) {
          console.error(`   Error updating name_bn for ID ${row.id}:`, updErr.message);
        } else {
          totalUpdated++;
        }
      }
    }

    // Check father_name
    const { data: fatherMatches, error: fatherErr } = await supabaseAdmin
      .from('voters')
      .select('id, father_name')
      .eq('father_name', r.from);
      
    if (fatherErr) {
      console.error('Error fetching father_name:', fatherErr.message);
      continue;
    }
    
    if (fatherMatches && fatherMatches.length > 0) {
      console.log(`   Found ${fatherMatches.length} matches in father_name. Updating...`);
      for (const row of fatherMatches) {
        const { error: updErr } = await supabaseAdmin
          .from('voters')
          .update({ father_name: r.to })
          .eq('id', row.id);
        if (updErr) {
          console.error(`   Error updating father_name for ID ${row.id}:`, updErr.message);
        } else {
          totalUpdated++;
        }
      }
    }

    // Check mother_name
    const { data: motherMatches, error: motherErr } = await supabaseAdmin
      .from('voters')
      .select('id, mother_name')
      .eq('mother_name', r.from);
      
    if (motherErr) {
      console.error('Error fetching mother_name:', motherErr.message);
      continue;
    }
    
    if (motherMatches && motherMatches.length > 0) {
      console.log(`   Found ${motherMatches.length} matches in mother_name. Updating...`);
      for (const row of motherMatches) {
        const { error: updErr } = await supabaseAdmin
          .from('voters')
          .update({ mother_name: r.to })
          .eq('id', row.id);
        if (updErr) {
          console.error(`   Error updating mother_name for ID ${row.id}:`, updErr.message);
        } else {
          totalUpdated++;
        }
      }
    }
  }
  
  console.log(`\n--- Supabase update finished. Total fields corrected: ${totalUpdated} ---`);
}

updateSupabase().catch(err => console.error('Unhandled script error:', err));
