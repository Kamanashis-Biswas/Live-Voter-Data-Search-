/**
 * @file types.ts
 * @description Core TypeScript interface definitions for the Live Voter Data Search application.
 * Defines search filters, database schemas, and request log metadata.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

/**
 * Filter parameters supplied by the client during voter searches.
 */
export interface SearchFilters {
  /** The full or partial name of the voter in Bengali (fuzzy matched) */
  name: string;
  /** The full or partial name of the voter's father in Bengali (fuzzy matched) */
  fatherName: string;
  /** The full or partial name of the voter's mother in Bengali (fuzzy matched) */
  motherName: string;
  /** The village or residential area of the voter (fuzzy matched) */
  village: string;
  /** Birth date string, typically in DD/MM/YYYY format */
  dob: string;
  /** Gender restriction filter */
  gender: 'all' | 'male' | 'female';
  /** Optional upazila (sub-district) constraint */
  upazila?: string;
  /** Optional district constraint */
  district?: string;
  /** Optional voter unique serial number string */
  voterNo?: string;
}

/**
 * Bounding box coordinate structure representing the position of a text item on a PDF page.
 * Uses standard PDF points (72 points per inch) in bottom-up Cartesian coordinate space.
 */
export interface BoundingBox {
  /** The X-coordinate starting from the left edge of the page */
  x: number;
  /** The Y-coordinate starting from the bottom edge of the page */
  y: number;
  /** Width of the boundary box */
  width: number;
  /** Height of the boundary box */
  height: number;
}

/**
 * Structured address object containing granular location components.
 */
export interface GranularAddress {
  village: string;
  postOffice: string;
  upazila: string;
  district: string;
}

/**
 * A complete, structured voter registry record.
 * Maps directly to individual entries processed from election commission PDF documents.
 */
export interface VoterRecord {
  /** Unique UUID v4 identifying this record in the database */
  id: string;
  /** National Identity Number (NID), if available */
  nid: string;
  /** Unique Voter Number (ভোটার নম্বর) assigned by the EC */
  voterNo: string;
  /** Name of the voter in Bengali Unicode */
  nameBn: string;
  /** Name of the voter in English characters (optional) */
  nameEn?: string;
  /** Father's name in Bengali Unicode */
  fatherName: string;
  /** Mother's name in Bengali Unicode */
  motherName: string;
  /** Birth date in DD/MM/YYYY format */
  dob: string;
  /** Residential village or residential sector */
  village: string;
  /** Gender categories supported by the portal */
  gender: 'পুরুষ' | 'মহিলা';
  /** Blood group indicator (optional) */
  bloodGroup?: string;
  /** Absolute URL to the voter's profile image (optional) */
  photoUrl?: string;
  /** Verification status of this voter registry entry */
  status: 'সক্রিয়' | 'স্থগিত' | 'সংশোধনযোগ্য';
  /** Legacy field mapping the PDF page number */
  page_number?: string;
  
  // ── Extended Fields Extracted from EC PDFs ─────────────────────────────────
  /** String serial number (ক্রমিক নম্বর) on the sheet (e.g., "০০০১") */
  serialNo?: string;
  /** The voter's declared occupation (পেশা) */
  occupation?: string;
  /** Union or Municipal ward name (ইউনিয়ন/পৌরসভা) */
  unionName?: string;
  /** Ward number string (ওয়ার্ড নম্বর) */
  wardNo?: string;
  /** The voter area designation (ভোটার এলাকা) */
  voterArea?: string;
  /** Numeric code representing the voter area (ভোটার এলাকা কোড) */
  voterAreaNo?: string;
  /** Sub-district name (উপজেলা) */
  upazila?: string;
  /** District name (জেলা) */
  district?: string;
  /** Postal code string (পোস্টকোড) */
  postCode?: string;
  /** Publication date of the election register */
  publicationDate?: string;
  /** Linked ID of the Uploaded PDF metadata record */
  pdfUploadId?: string;
  /** The exact physical page index within the PDF file where this record is drawn */
  pdfPageNumber?: number;
  /** Numerical translation of the serial number (e.g. 1) */
  serialNum?: number;
  /** The relative grid index on the sheet (1 to 15, left-to-right, top-to-bottom) */
  serialOnPage?: number;
  /** Precision coordinates mapping the first line of the voter block inside the PDF file */
  boundingBox?: BoundingBox;
  /** Granular address object (fallback support) */
  address?: GranularAddress;
}

/**
 * Meta-record describing an uploaded voter register PDF document.
 */
export interface UploadedPdf {
  /** Unique UUID v4 identifying this file in the database */
  id: string;
  /** Original name of the file uploaded by the administrator */
  fileName: string;
  /** Pre-formatted string indicating file size in Megabytes (e.g., "4.25 MB") */
  fileSize: string;
  /** Formatted upload date and time string */
  uploadTime: string;
  
  // ── Cover Page Metadata (Page 1) ──────────────────────────────────────────
  /** District name */
  district: string;
  /** Upazila/Thana name */
  upazila: string;
  /** Union name */
  unionName: string;
  /** Ward number */
  wardNo: string;
  /** Voter area name */
  voterArea: string;
  /** Voter area code */
  voterAreaNo: string;
  /** Total declared voters drawn on Page 1 cover summary */
  totalVoters: number;
  /** Total calculated female voters on Page 1 cover summary */
  totalFemaleVoters?: number;
  /** Total calculated male voters on Page 1 cover summary */
  totalMaleVoters?: number;
  /** Gender demographic layout of this list */
  genderType: 'মহিলা' | 'পুরুষ' | 'উভয়';
  /** Register publication date */
  publicationDate: string;
  /** Post code designation (optional) */
  postCode?: string;
  
  // ── Parse Operational Meta ────────────────────────────────────────────────
  /** Count of voters successfully parsed and inserted from this PDF */
  voterCount: number;
  /** Total pages in the physical document */
  totalPages?: number;
  /** Processing stage status */
  status: 'সফল' | 'প্রক্রিয়াধীন' | 'ত্রুটি';
  /** SHA-256 integrity hash of the PDF bytes (optional) */
  integrityHash?: string;
  /** ISO timestamp string when database write committed */
  uploadedAt?: string;
  pageNumber?: string;
  detectedArea?: string;
  /** List of UUIDs representing voters loaded from this document */
  voterIds?: string[];
}

/**
 * Activity log record for client search requests.
 */
export interface SearchLog {
  /** Unique tracking ID */
  id: string;
  /** Date and local time string when search executed */
  dateTime: string;
  /** Anonymized or local client IP address */
  ipAddress: string;
  /** String summary detailing keys and terms queried */
  query: string;
  /** Total time elapsed on the server in milliseconds (e.g., "5ms") */
  responseTime: string;
  /** Final operational status */
  status: 'Success' | 'Failed' | 'Warning';
  /** Internal classification tag mapping the search entry trigger */
  method: string;
}
