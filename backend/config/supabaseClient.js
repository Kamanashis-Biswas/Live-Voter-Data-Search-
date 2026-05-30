const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file!');
  process.exit(1);
}

console.log(`✅ Supabase connecting to: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;

