-- =====================================================
-- COMPLETE Supabase Setup SQL
-- Project: mwaunefaisntuierdtso.supabase.co
-- 
-- STEPS:
-- 1. Supabase Dashboard খুলুন: https://supabase.com/dashboard
-- 2. আপনার project সিলেক্ট করুন
-- 3. বাম মেনু থেকে "SQL Editor" ক্লিক করুন
-- 4. নিচের সম্পূর্ণ SQL copy করে paste করুন
-- 5. "Run" বাটনে ক্লিক করুন
-- =====================================================

-- ১. voters table তৈরি করুন
CREATE TABLE IF NOT EXISTS voters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nid text,
  voter_no text,
  name_bn text NOT NULL,
  name_en text,
  father_name text,
  mother_name text,
  dob text,
  village text,
  gender text,
  blood_group text,
  photo_url text,
  occupation text,
  serial_no text,
  union_name text,
  ward_no text,
  voter_area text,
  voter_area_no text,
  upazila text,
  district text,
  post_code text,
  publication_date text,
  page_number text,
  pdf_upload_id uuid,
  status text DEFAULT 'সক্রিয়',
  created_at timestamptz DEFAULT now()
);

-- ২. pdf_uploads table তৈরি করুন
CREATE TABLE IF NOT EXISTS pdf_uploads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  file_size text,
  district text,
  upazila text,
  union_name text,
  ward_no text,
  voter_area text,
  voter_area_no text,
  total_voters integer DEFAULT 0,
  total_female_voters integer DEFAULT 0,
  gender_type text DEFAULT 'উভয়',
  publication_date text,
  post_code text,
  voter_count integer DEFAULT 0,
  status text DEFAULT 'সফল',
  integrity_hash text,
  uploaded_at timestamptz DEFAULT now()
);

-- ৩. Foreign key যোগ করুন
ALTER TABLE voters 
  ADD COLUMN IF NOT EXISTS pdf_upload_id uuid;

-- ৪. Search-এর জন্য index তৈরি করুন (fast query)
CREATE INDEX IF NOT EXISTS idx_voters_name_bn ON voters USING gin(to_tsvector('simple', name_bn));
CREATE INDEX IF NOT EXISTS idx_voters_father_name ON voters(father_name);
CREATE INDEX IF NOT EXISTS idx_voters_village ON voters(village);
CREATE INDEX IF NOT EXISTS idx_voters_nid ON voters(nid);
CREATE INDEX IF NOT EXISTS idx_voters_district ON voters(district);
CREATE INDEX IF NOT EXISTS idx_voters_voter_area ON voters(voter_area);
CREATE INDEX IF NOT EXISTS idx_voters_pdf_upload_id ON voters(pdf_upload_id);

-- ৫. RLS disable করুন (development এর জন্য)
ALTER TABLE voters DISABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_uploads DISABLE ROW LEVEL SECURITY;

-- ৬. Public access grant করুন
GRANT ALL ON voters TO anon, authenticated;
GRANT ALL ON pdf_uploads TO anon, authenticated;

-- Verify: Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('voters', 'pdf_uploads');
