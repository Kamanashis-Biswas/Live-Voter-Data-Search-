const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Make Supabase optional — the app works in local-only mode without it
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  WARNING: SUPABASE_URL and SUPABASE_ANON_KEY not set in .env file.');
  console.warn('   Auth features (login/signup) will not work.');
  console.warn('   PDF upload and voter search will still work in local mode.');
}

let supabase = null;
let supabaseAdmin = null;

if (supabaseUrl && supabaseAnonKey) {
  console.log(`✅ Supabase connecting to: ${supabaseUrl}`);
  supabase = createClient(supabaseUrl, supabaseAnonKey);

  if (supabaseServiceRoleKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
}

module.exports = { supabase, supabaseAdmin };
