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
  nameEn: string;
  fatherName: string;
  motherName: string;
  dob: string;
  village: string;
  gender: 'পুরুষ' | 'মহিলা';
  bloodGroup: string;
  photoUrl: string;
  status: 'সক্রিয়' | 'স্থগিত' | 'সংশোধনযোগ্য';
  page_number: string;
  address: {
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
  pageNumber: string;
  detectedArea: string;
  status: 'সফল' | 'প্রক্রিয়াধীন' | 'ত্রুটি';
  integrityHash: string;
  voterIds: string[];
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
