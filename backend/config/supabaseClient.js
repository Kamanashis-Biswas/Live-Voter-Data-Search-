const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://lqzbytwfndscgpkemovz.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxeWJ5dHdmbmRzY2dwa2Vtb3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODg0MDAwMDAsImV4cCI6MjAwNDAwMDAwMH0.demo-placeholder-signature-key-goes-here';

// Fail-safe validation checks for production deployment readiness
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.log(
    'ℹ️ INFO: Using backend demo Supabase URL & Key fallback values.\n' +
    'Provide SUPABASE_URL and SUPABASE_ANON_KEY environment variables to connect to your production instance.'
  );
}

/**
 * Supabase Client Instance
 * Securely initialized with the project details
 */
const supabase = createClient(
  supabaseUrl || 'https://placeholder-project-id.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

module.exports = supabase;
