export interface SearchFilters {
  name: string;
  fatherName: string;
  motherName: string;
  village: string;
  dob: string;
  gender: 'all' | 'male' | 'female';
}

export interface VoterRecord {
  id: string;
  nid: string;
  voterNo: string;
  nameBn: string;
  nameEn?: string;
  fatherName: string;
  motherName: string;
  dob: string;
  village: string;
  gender: 'পুরুষ' | 'মহিলা';
  bloodGroup?: string;
  photoUrl?: string;
  status: 'সক্রিয়' | 'স্থগিত' | 'সংশোধনযোগ্য';
  page_number?: string;
  // New fields from PDF
  serialNo?: string;       // ক্রমিক নম্বর
  occupation?: string;     // পেশা
  unionName?: string;      // ইউনিয়ন
  wardNo?: string;         // ওয়ার্ড নম্বর
  voterArea?: string;      // ভোটার এলাকা
  voterAreaNo?: string;    // ভোটার এলাকার নম্বর
  upazila?: string;        // উপজেলা
  district?: string;       // জেলা
  postCode?: string;       // পোস্টকোড
  publicationDate?: string; // প্রকাশের তারিখ
  pdfUploadId?: string;    // linked PDF upload
  address?: {
    village: string;
    postOffice: string;
    upazila: string;
    district: string;
  };
}

export interface UploadedPdf {
  id: string;
  fileName: string;
  fileSize: string;
  uploadTime: string;
  // Cover page info
  district: string;           // জেলা
  upazila: string;            // উপজেলা
  unionName: string;          // ইউনিয়ন/পৌর ওয়ার্ড
  wardNo: string;             // ওয়ার্ড নম্বর
  voterArea: string;          // ভোটার এলাকা
  voterAreaNo: string;        // ভোটার এলাকার নম্বর
  totalVoters: number;        // সর্বমোট ভোটার সংখ্যা
  totalFemaleVoters?: number; // মোট মহিলা ভোটার সংখ্যা
  genderType: 'মহিলা' | 'পুরুষ' | 'উভয়'; // ভোটার তালিকার ধরন
  publicationDate: string;    // প্রকাশের তারিখ
  postCode?: string;          // পোস্টকোড
  voterCount: number;         // সিস্টেমে যুক্ত voter count
  status: 'সফল' | 'প্রক্রিয়াধীন' | 'ত্রুটি';
  integrityHash?: string;
  // Legacy — kept for backward compat
  pageNumber?: string;
  detectedArea?: string;
  voterIds?: string[];
}

export interface SearchLog {
  id: string;
  dateTime: string;
  ipAddress: string;
  query: string;
  responseTime: string;
  status: 'Success' | 'Failed' | 'Warning';
  method: string;
}
