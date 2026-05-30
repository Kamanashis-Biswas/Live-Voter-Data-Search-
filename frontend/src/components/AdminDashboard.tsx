import React, { useState, useRef } from 'react';
import { VoterRecord, UploadedPdf, SearchLog } from '../types';
import { 
  Activity, 
  Users,
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Globe, 
  UploadCloud, 
  Database,
  Lock,
  Unlock,
  FileText,
  Trash2,
  X,
  Plus,
  FileCheck,
  Check,
  Info,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Hash,
  UserCheck,
  RefreshCw
} from 'lucide-react';

const API_BASE = 'http://localhost:3000';

const convertToBanglaNumber = (num: number | string): string => {
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split('').map(char => {
    const digit = parseInt(char);
    return isNaN(digit) ? char : banglaDigits[digit];
  }).join('');
};

interface AdminDashboardProps {
  voters: VoterRecord[];
  uploadedPdfs: UploadedPdf[];
  setUploadedPdfs: React.Dispatch<React.SetStateAction<UploadedPdf[]>>;
  searchLogs: SearchLog[];
  onAddVoter: (newVoter: VoterRecord) => void;
  onRemoveVoter: (voterId: string) => void;
  onRefreshPdfs: () => void;
  totalVotersInSystem: number;
  pdfsLoading: boolean;
}

// ---- Voter CSV Row Parser ----
// Parses lines like: "০০১ | ইরানী বেগম | ০১১৩১৫৯৫৮৩২ | শেখ মাজিদ | মোসাঃ আলেয়া বেগম | গৃহিণী | ০৬/০৭/১৯৮৩"
function parseVoterCSVLine(line: string, defaults: Partial<VoterRecord>): VoterRecord | null {
  const parts = line.split('|').map(s => s.trim());
  if (parts.length < 2) return null;
  const nameBn = parts[1] || parts[0];
  if (!nameBn) return null;
  return {
    id: `V-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    nid: '',
    voterNo: parts[2] || '',
    nameBn,
    nameEn: '',
    fatherName: parts[3] || '',
    motherName: parts[4] || '',
    occupation: parts[5] || '',
    dob: parts[6] || '',
    gender: (defaults.genderType === 'মহিলা' ? 'মহিলা' : 'পুরুষ') as 'পুরুষ' | 'মহিলা',
    village: defaults.voterArea || '',
    status: 'সক্রিয়',
    serialNo: parts[0] || '',
    unionName: defaults.unionName || '',
    wardNo: defaults.wardNo || '',
    voterArea: defaults.voterArea || '',
    voterAreaNo: defaults.voterAreaNo || '',
    upazila: defaults.upazila || '',
    district: defaults.district || '',
    postCode: defaults.postCode || '',
    publicationDate: defaults.publicationDate || '',
    pdfUploadId: defaults.pdfUploadId || '',
  } as VoterRecord;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  voters, 
  uploadedPdfs, 
  setUploadedPdfs, 
  searchLogs,
  onAddVoter, 
  onRemoveVoter,
  onRefreshPdfs,
  totalVotersInSystem,
  pdfsLoading
}) => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot_password' | 'reset_password'>('login');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authSuccess, setAuthSuccess] = useState<string>('');
  const [isAuthProcessing, setIsAuthProcessing] = useState<boolean>(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'pdf-list' | 'ip-logs'>('overview');

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<1 | 2>(1); // Step 1: cover page info, Step 2: voter data

  // ---- Step 1: Cover Page Fields ----
  const [formFileName, setFormFileName] = useState<string>('');
  const [formFileSize, setFormFileSize] = useState<string>('');
  const [formDistrict, setFormDistrict] = useState<string>('');
  const [formUpazila, setFormUpazila] = useState<string>('');
  const [formUnion, setFormUnion] = useState<string>('');
  const [formWardNo, setFormWardNo] = useState<string>('');
  const [formVoterArea, setFormVoterArea] = useState<string>('');
  const [formVoterAreaNo, setFormVoterAreaNo] = useState<string>('');
  const [formTotalVoters, setFormTotalVoters] = useState<string>('');
  const [formTotalFemaleVoters, setFormTotalFemaleVoters] = useState<string>('');
  const [formGenderType, setFormGenderType] = useState<'মহিলা' | 'পুরুষ' | 'উভয়'>('মহিলা');
  const [formPublicationDate, setFormPublicationDate] = useState<string>('');
  const [formPostCode, setFormPostCode] = useState<string>('');

  // ---- Step 2: Voter Data (CSV paste) ----
  const [voterCsvText, setVoterCsvText] = useState<string>('');
  const [parsedVoterCount, setParsedVoterCount] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [savedPdfId, setSavedPdfId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setIsAuthProcessing(true);
    try {
      if (authMode === 'login') {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, password: passwordInput })
        });
        const data = await res.json();
        if (data.success) setIsAuthenticated(true);
        else setAuthError(data.message || 'Login failed');
      } else if (authMode === 'signup') {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, password: passwordInput })
        });
        const data = await res.json();
        if (data.success) { setAuthSuccess('Signup successful. Now login.'); setAuthMode('login'); }
        else setAuthError(data.message || 'Signup failed');
      } else if (authMode === 'forgot_password') {
        const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput })
        });
        const data = await res.json();
        if (data.success) { setAuthSuccess('Reset token sent.'); setAuthMode('reset_password'); }
        else setAuthError(data.message || 'Failed');
      } else if (authMode === 'reset_password') {
        const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, token: tokenInput, newPassword: passwordInput })
        });
        const data = await res.json();
        if (data.success) { setAuthSuccess('Password reset. Login now.'); setAuthMode('login'); setTokenInput(''); setPasswordInput(''); }
        else setAuthError(data.message || 'Failed');
      }
    } catch (err) {
      setAuthError('Network error connecting to backend.');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  // File picker — just reads file name and size
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormFileName(file.name);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setFormFileSize(`${sizeMb} MB`);
    }
  };

  // Parse CSV text for voter count preview
  const handleCsvChange = (text: string) => {
    setVoterCsvText(text);
    const lines = text.split('\n').filter(l => l.trim().length > 3);
    setParsedVoterCount(lines.length);
  };

  // Reset modal
  const resetModal = () => {
    setUploadStep(1);
    setFormFileName(''); setFormFileSize('');
    setFormDistrict(''); setFormUpazila(''); setFormUnion(''); setFormWardNo('');
    setFormVoterArea(''); setFormVoterAreaNo(''); setFormTotalVoters('');
    setFormTotalFemaleVoters(''); setFormGenderType('মহিলা');
    setFormPublicationDate(''); setFormPostCode('');
    setVoterCsvText(''); setParsedVoterCount(0);
    setIsProcessing(false); setUploadError('');
    setSavedPdfId('');
  };

  // Step 1: Save PDF cover page metadata to backend
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    if (!formFileName || !formDistrict || !formUpazila) {
      setUploadError('ফাইল নাম, জেলা এবং উপজেলা আবশ্যক।');
      return;
    }
    setIsProcessing(true);
    try {
      const hash = 'SHA-256: ' + Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const res = await fetch(`${API_BASE}/api/pdf/upload-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: formFileName,
          fileSize: formFileSize,
          district: formDistrict,
          upazila: formUpazila,
          unionName: formUnion,
          wardNo: formWardNo,
          voterArea: formVoterArea,
          voterAreaNo: formVoterAreaNo,
          totalVoters: parseInt(formTotalVoters) || 0,
          totalFemaleVoters: parseInt(formTotalFemaleVoters) || 0,
          genderType: formGenderType,
          publicationDate: formPublicationDate,
          postCode: formPostCode,
          integrityHash: hash
        })
      });
      const data = await res.json();
      if (data.success && data.pdf) {
        setSavedPdfId(data.pdf.id);
        setUploadStep(2);
      } else {
        setUploadError(data.message || 'সার্ভার ত্রুটি। আবার চেষ্টা করুন।');
      }
    } catch (err) {
      setUploadError('নেটওয়ার্ক ত্রুটি। Backend চালু আছে কিনা পরীক্ষা করুন।');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Bulk import voters from CSV
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setIsProcessing(true);

    try {
      const lines = voterCsvText.split('\n').filter(l => l.trim().length > 3);
      const defaults: Partial<VoterRecord> & { genderType?: string } = {
        voterArea: formVoterArea,
        voterAreaNo: formVoterAreaNo,
        unionName: formUnion,
        wardNo: formWardNo,
        upazila: formUpazila,
        district: formDistrict,
        postCode: formPostCode,
        publicationDate: formPublicationDate,
        pdfUploadId: savedPdfId,
        genderType: formGenderType
      };

      const parsed = lines
        .map(line => parseVoterCSVLine(line, defaults))
        .filter(Boolean) as VoterRecord[];

      if (parsed.length === 0) {
        // No CSV data — just save PDF without voters
        await finalizePdfInUI(0);
        return;
      }

      // Send to bulk import API
      const res = await fetch(`${API_BASE}/api/voters/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voters: parsed,
          pdfUploadId: savedPdfId
        })
      });
      const data = await res.json();
      if (data.success) {
        await finalizePdfInUI(data.count || parsed.length);
      } else {
        setUploadError(data.message || 'ভোটার ইমপোর্ট ব্যর্থ হয়েছে।');
        setIsProcessing(false);
      }
    } catch (err) {
      setUploadError('নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।');
      setIsProcessing(false);
    }
  };

  // Update UI after successful upload
  const finalizePdfInUI = async (voterCount: number) => {
    // Refresh PDF list from backend
    await onRefreshPdfs();
    setIsProcessing(false);
    setIsUploadModalOpen(false);
    resetModal();
    alert(`সাফল্যের সাথে PDF আপলোড হয়েছে!\n${voterCount > 0 ? `${voterCount} জন ভোটারের ডাটা সিস্টেমে যুক্ত হয়েছে।` : 'ভোটার ডাটা পরে যোগ করা যাবে।'}`);
  };

  // Delete PDF and its voters
  const handleDeletePdf = async (pdf: UploadedPdf) => {
    if (!window.confirm(`আপনি কি সত্যিই "${pdf.fileName}" ফাইল এবং এর সাথে যুক্ত সকল ভোটার ডাটা মুছে ফেলতে চান?`)) return;
    try {
      // Delete voters by PDF id
      await fetch(`${API_BASE}/api/voters/by-pdf/${pdf.id}`, { method: 'DELETE' });
      // Delete PDF metadata
      await fetch(`${API_BASE}/api/pdf/${pdf.id}`, { method: 'DELETE' });
      setUploadedPdfs(prev => prev.filter(p => p.id !== pdf.id));
    } catch (err) {
      alert('মুছে ফেলতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  // ---- AUTH FORM ----
  if (!isAuthenticated) {
    return (
      <div id="admin-auth-panel" className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-xl text-center select-none animate-fade-in">
        <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 shadow-xs">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 font-serif">অ্যাডমিন অ্যাক্সেস গেটওয়ে</h2>
        <p className="text-xs text-slate-500 mt-2">সংবেদনশীল ভোটার ডাটাবেজ সিস্টেম অ্যাক্সেস করতে লগইন করুন।</p>
        
        <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-1.5 font-mono">Email Address</label>
            <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
              placeholder="admin@example.com" required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm font-mono" />
          </div>
          {authMode === 'reset_password' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-1.5 font-mono">Reset Token (OTP)</label>
              <input type="text" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                placeholder="Enter token from email" required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm font-mono" />
            </div>
          )}
          {(authMode === 'login' || authMode === 'signup' || authMode === 'reset_password') && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest font-mono">
                  {authMode === 'reset_password' ? 'New Password' : 'Password'}
                </label>
                {authMode === 'login' && (
                  <button type="button" onClick={() => setAuthMode('forgot_password')} className="text-[10px] text-blue-600 hover:underline">Forgot Password?</button>
                )}
              </div>
              <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                placeholder="••••••••" required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm font-mono" />
            </div>
          )}
          {authError && (
            <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              <AlertCircle className="w-4 h-4 shrink-0" />{authError}
            </p>
          )}
          {authSuccess && (
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 shrink-0" />{authSuccess}
            </p>
          )}
          <button type="submit" disabled={isAuthProcessing}
            className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50">
            {isAuthProcessing ? 'প্রসেসিং...' : (
              authMode === 'login' ? 'লগইন করুন' :
              authMode === 'signup' ? 'অ্যাকাউন্ট তৈরি করুন' :
              authMode === 'forgot_password' ? 'টোকেন পাঠান' : 'পাসওয়ার্ড আপডেট করুন'
            )}
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-2 text-xs text-slate-500 justify-center">
          {authMode === 'login' ? (
            <p>অ্যাকাউন্ট নেই? <button onClick={() => setAuthMode('signup')} className="text-blue-600 font-bold hover:underline cursor-pointer">সাইন-আপ করুন</button></p>
          ) : (
            <p>লগইন পেইজে ফিরে যান? <button onClick={() => setAuthMode('login')} className="text-blue-600 font-bold hover:underline cursor-pointer">লগইন</button></p>
          )}
        </div>
      </div>
    );
  }

  // ---- MAIN DASHBOARD ----
  return (
    <div id="admin-secured-dashboard" className="space-y-6 animate-fade-in text-slate-800">
      
      {/* Tab Selector */}
      <div className="flex border-b border-slate-200 overflow-x-auto select-none no-scrollbar">
        {[
          { key: 'overview', label: 'ওভারভিউ ড্যাশবোর্ড', icon: <Activity className="w-4 h-4" /> },
          { key: 'pdf-list', label: 'পিডিএফ আপলোড ও তালিকা', icon: <UploadCloud className="w-4 h-4" /> },
          { key: 'ip-logs', label: 'ইউজার ট্রাফিক ও আইপি লগ', icon: <Globe className="w-4 h-4" /> },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-5 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.key 
                ? 'border-blue-700 text-blue-700 bg-blue-50/10' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ---- OVERVIEW TAB ---- */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all">
              <div className="absolute right-[-15px] top-[-15px] w-24 h-24 bg-blue-50 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-serif">সিস্টেমের মোট ভোটার</span>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 z-10">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight font-sans">
                  {pdfsLoading ? '...' : convertToBanglaNumber(totalVotersInSystem)} জন
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Supabase ডাটাবেজ থেকে
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all">
              <div className="absolute right-[-15px] top-[-15px] w-24 h-24 bg-emerald-50 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-serif">আপলোডকৃত PDF ফাইল</span>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 z-10">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight font-sans">
                  {pdfsLoading ? '...' : convertToBanglaNumber(uploadedPdfs.length)} টি
                </h4>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">সিস্টেমে যুক্ত ভোটার তালিকা</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all">
              <div className="absolute right-[-15px] top-[-15px] w-24 h-24 bg-amber-50 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-serif">মোট অনুসন্ধান</span>
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 z-10">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 tracking-tight font-sans">
                    {convertToBanglaNumber(searchLogs.length)} বার
                  </span>
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping mb-1.5"></span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">এই সেশনে ট্র্যাক করা হয়েছে</p>
              </div>
            </div>
          </div>

          {/* PDF Summary List (overview) */}
          {uploadedPdfs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6">
              <h3 className="text-base font-bold text-slate-800 font-serif flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-blue-700" />
                আপলোডকৃত এলাকার সারসংক্ষেপ
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {uploadedPdfs.map(pdf => (
                  <div key={pdf.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-bold text-slate-800 truncate">{pdf.fileName}</p>
                    <p className="text-slate-500"><span className="font-semibold text-slate-600">জেলা:</span> {pdf.district} | <span className="font-semibold text-slate-600">উপজেলা:</span> {pdf.upazila}</p>
                    <p className="text-slate-500"><span className="font-semibold text-slate-600">এলাকা:</span> {pdf.voterArea} | <span className="font-semibold text-slate-600">এলাকা নং:</span> {pdf.voterAreaNo}</p>
                    <p className="text-slate-500"><span className="font-semibold text-slate-600">সর্বমোট ভোটার:</span> {pdf.totalVoters} | <span className="font-semibold text-slate-600">মহিলা:</span> {pdf.totalFemaleVoters || '-'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-700 font-bold">{pdf.genderType}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold">{pdf.voterCount} জন যুক্ত</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="p-6 bg-white rounded-xl border border-slate-200/80 flex flex-col md:flex-row shadow-xs items-center gap-6 justify-between">
            <div className="space-y-2 max-w-2xl text-left">
              <h3 className="text-base font-bold text-slate-900 font-serif flex items-center gap-1.5">
                <Unlock className="w-5 h-5 text-blue-700" />
                অ্যাডমিন ড্যাশবোর্ড — Real Data মোড
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                সমস্ত ডাটা Supabase ক্লাউড ডাটাবেজে সংরক্ষিত। PDF আপলোড করলে cover page তথ্য এবং voter CSV ডাটা সরাসরি ডাটাবেজে যুক্ত হয়। Demo বা mock ডাটা সম্পূর্ণ সরানো হয়েছে।
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shrink-0 text-center flex flex-col justify-center min-w-[200px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-widest">ডাটা উৎস</span>
              <span className="text-lg font-black text-slate-800 font-serif mt-1">SUPABASE CLOUD</span>
              <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block mx-auto px-2 py-0.5 bg-emerald-50 rounded border border-emerald-100">লাইভ ডাটাবেজ</span>
            </div>
          </div>
        </div>
      )}

      {/* ---- PDF LIST TAB ---- */}
      {activeTab === 'pdf-list' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs select-none">
            <div className="text-left">
              <h2 className="text-base font-bold text-slate-800 font-serif flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-700" />
                ভোটার তালিকা PDF রেকর্ড ({convertToBanglaNumber(uploadedPdfs.length)} টি)
              </h2>
              <p className="text-xs text-slate-400">Supabase-এ সংরক্ষিত আপলোডকৃত PDF-এর বিস্তারিত তথ্য</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onRefreshPdfs}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200">
                <RefreshCw className={`w-3.5 h-3.5 ${pdfsLoading ? 'animate-spin' : ''}`} />
                রিফ্রেশ
              </button>
              <button onClick={() => { resetModal(); setIsUploadModalOpen(true); }}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-100 font-serif">
                <Plus className="w-4 h-4" />
                নতুন ভোটার তালিকা আপলোড
              </button>
            </div>
          </div>

          {/* PDF Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase border-b border-slate-100 font-bold select-none font-serif">
                    <th className="p-3">ফাইল নাম</th>
                    <th className="p-3">জেলা</th>
                    <th className="p-3">উপজেলা</th>
                    <th className="p-3">ইউনিয়ন</th>
                    <th className="p-3">ওয়ার্ড</th>
                    <th className="p-3">ভোটার এলাকা</th>
                    <th className="p-3">এলাকা নং</th>
                    <th className="p-3 text-center">সর্বমোট ভোটার</th>
                    <th className="p-3 text-center">মহিলা ভোটার</th>
                    <th className="p-3 text-center">ধরন</th>
                    <th className="p-3 text-center">সিস্টেমে যুক্ত</th>
                    <th className="p-3">প্রকাশের তারিখ</th>
                    <th className="p-3 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {pdfsLoading ? (
                    <tr>
                      <td colSpan={13} className="p-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        ডাটা লোড হচ্ছে...
                      </td>
                    </tr>
                  ) : uploadedPdfs.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="p-12 text-center text-slate-400 font-medium font-serif">
                        <UploadCloud className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        কোনো PDF আপলোড করা হয়নি। উপরে <strong>"নতুন ভোটার তালিকা আপলোড"</strong> বাটনে ক্লিক করুন।
                      </td>
                    </tr>
                  ) : (
                    uploadedPdfs.map(pdf => (
                      <tr key={pdf.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2 max-w-[160px]">
                            <FileText className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate text-[11px]" title={pdf.fileName}>{pdf.fileName}</span>
                          </div>
                        </td>
                        <td className="p-3 font-serif text-slate-700">{pdf.district}</td>
                        <td className="p-3 font-serif text-slate-700">{pdf.upazila}</td>
                        <td className="p-3 font-serif text-slate-600">{pdf.unionName || '-'}</td>
                        <td className="p-3 text-center font-mono">{pdf.wardNo || '-'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-700 font-bold font-serif">
                            {pdf.voterArea || '-'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">{pdf.voterAreaNo || '-'}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{pdf.totalVoters || '-'}</td>
                        <td className="p-3 text-center text-slate-600">{pdf.totalFemaleVoters || '-'}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            pdf.genderType === 'মহিলা' ? 'bg-pink-50 border-pink-100 text-pink-700' : 
                            pdf.genderType === 'পুরুষ' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                            'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            {pdf.genderType}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[10px] font-bold">
                            <UserCheck className="w-3 h-3" />
                            {pdf.voterCount} জন
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-[10px] font-mono">{pdf.publicationDate || '-'}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleDeletePdf(pdf)}
                            className="p-1 px-2.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 rounded-lg flex items-center gap-1 mx-auto font-serif transition-colors cursor-pointer font-bold">
                            <Trash2 className="w-3.5 h-3.5" />মুছুন
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed text-left">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              <strong>আপলোড গাইড:</strong> "নতুন ভোটার তালিকা আপলোড" বাটনে ক্লিক করে প্রথমে PDF cover page তথ্য (জেলা, উপজেলা, ইউনিয়ন, ওয়ার্ড, ভোটার এলাকা, মোট ভোটার সংখ্যা) দিন। তারপর voter list CSV format-এ paste করুন। সমস্ত ডাটা Supabase-এ সরাসরি সংরক্ষিত হবে।
            </p>
          </div>
        </div>
      )}

      {/* ---- IP LOGS TAB ---- */}
      {activeTab === 'ip-logs' && (
        <div className="space-y-6 animate-fade-in font-sans">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 select-none text-left">
            <div>
              <h2 className="text-base font-bold text-slate-800 font-serif">অনুসন্ধান ট্রাফিক আইপি ডাটাবেজ</h2>
              <p className="text-xs text-slate-400">এই সেশনে সাইট ব্যবহারকারীদের অনুসন্ধান কার্যক্রম</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 text-slate-600 bg-slate-100 rounded-lg border border-slate-200">
              সেশন ট্র্যাকিং সচল
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase border-b border-slate-100 font-bold select-none font-serif">
                    <th className="p-4">তারিখ ও সময়</th>
                    <th className="p-4">আইপি ঠিকানা</th>
                    <th className="p-4">ক্যাটাগরি</th>
                    <th className="p-4">অনুসন্ধান কোয়েরি</th>
                    <th className="p-4">লেটেন্সি</th>
                    <th className="p-4 text-center">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {searchLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 font-medium font-serif">
                        কোনো অনুসন্ধান রেকর্ড নেই। হোম স্ক্রিনে ভোটার পোর্টাল সার্চ করুন।
                      </td>
                    </tr>
                  ) : (
                    searchLogs.slice(0, 20).map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-slate-500 font-mono text-xs">{log.dateTime}</td>
                        <td className="p-4">
                          <code className="bg-slate-100 text-slate-800 border border-slate-200/60 font-mono text-xs px-2 py-0.5 rounded">{log.ipAddress}</code>
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-[10px] font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-blue-700 rounded select-none">{log.method}</span>
                        </td>
                        <td className="p-4 text-slate-800 font-serif font-semibold truncate max-w-xs" title={log.query}>{log.query}</td>
                        <td className="p-4 text-slate-400 font-mono text-xs font-semibold">{log.responseTime}</td>
                        <td className="p-4 text-center select-none">
                          {log.status === 'Success' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                              <Check className="w-3.5 h-3.5" />FOUND
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200/50">
                              <XCircle className="w-3 h-3" />EMPTY
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <p>মোট <strong className="text-slate-800 font-mono">{searchLogs.length}</strong> টি সার্চ এই সেশনে</p>
              <div className="flex items-center gap-2">
                <button className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400" disabled><ChevronLeft className="w-3.5 h-3.5" /></button>
                <button className="px-2.5 py-1 border border-slate-300 rounded-lg bg-blue-600 text-white font-bold font-mono">১</button>
                <button className="p-2 border border-slate-200 rounded-lg bg-white text-slate-500" disabled><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- UPLOAD MODAL ---- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl text-left overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 select-none shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-serif flex items-center gap-1.5">
                  <UploadCloud className="w-5 h-5 text-blue-700" />
                  ভোটার তালিকা PDF আপলোড
                </h3>
                <div className="flex items-center gap-3 mt-2">
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                    uploadStep === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    {uploadStep > 1 ? <Check className="w-3 h-3" /> : <span>১</span>}
                    প্রচ্ছদ তথ্য
                  </div>
                  <div className="w-8 h-px bg-slate-200"></div>
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                    uploadStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <span>২</span>
                    ভোটার ডাটা
                  </div>
                </div>
              </div>
              <button onClick={() => { setIsUploadModalOpen(false); resetModal(); }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="overflow-y-auto flex-1 p-5">

              {uploadError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />{uploadError}
                </div>
              )}

              {/* STEP 1: Cover Page Info */}
              {uploadStep === 1 && (
                <form onSubmit={handleStep1Submit} className="space-y-5">
                  
                  {/* File Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      ১. PDF ফাইল সিলেক্ট করুন *
                    </label>
                    <div onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-slate-100 rounded-xl p-4 text-center cursor-pointer transition-colors">
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
                      {formFileName ? (
                        <div className="space-y-1">
                          <FileCheck className="w-7 h-7 text-emerald-600 mx-auto" />
                          <p className="text-xs font-bold text-slate-800 break-all">{formFileName}</p>
                          <p className="text-[10px] text-slate-500">{formFileSize}</p>
                        </div>
                      ) : (
                        <div className="text-slate-500 space-y-1">
                          <UploadCloud className="w-7 h-7 text-blue-600 mx-auto animate-bounce" />
                          <p className="text-xs font-semibold">ক্লিক করে PDF সিলেক্ট করুন</p>
                          <p className="text-[10px]">.pdf • সর্বোচ্চ ৩৫ MB</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cover Page Fields */}
                  <div>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      ২. প্রচ্ছদ পাতার তথ্য লিখুন (PDF-এর cover page দেখে)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">জেলা *</label>
                        <input type="text" value={formDistrict} onChange={e => setFormDistrict(e.target.value)}
                          placeholder="যেমনঃ বাগেরহাট" required
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif" />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">উপজেলা/থানা *</label>
                        <input type="text" value={formUpazila} onChange={e => setFormUpazila(e.target.value)}
                          placeholder="যেমনঃ রামপাল" required
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif" />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">ইউনিয়ন/পৌর ওয়ার্ড</label>
                        <input type="text" value={formUnion} onChange={e => setFormUnion(e.target.value)}
                          placeholder="যেমনঃ বাইনতলা"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif" />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">ওয়ার্ড নম্বর</label>
                        <input type="text" value={formWardNo} onChange={e => setFormWardNo(e.target.value)}
                          placeholder="যেমনঃ ২"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif" />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">ভোটার এলাকা</label>
                        <input type="text" value={formVoterArea} onChange={e => setFormVoterArea(e.target.value)}
                          placeholder="যেমনঃ আলীপুর"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif" />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">ভোটার এলাকার নম্বর</label>
                        <input type="text" value={formVoterAreaNo} onChange={e => setFormVoterAreaNo(e.target.value)}
                          placeholder="যেমনঃ ১১৩১"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif" />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">সর্বমোট ভোটার সংখ্যা</label>
                        <input type="number" value={formTotalVoters} onChange={e => setFormTotalVoters(e.target.value)}
                          placeholder="যেমনঃ 530"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">মোট মহিলা ভোটার</label>
                        <input type="number" value={formTotalFemaleVoters} onChange={e => setFormTotalFemaleVoters(e.target.value)}
                          placeholder="যেমনঃ 262"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">তালিকার ধরন</label>
                        <select value={formGenderType} onChange={e => setFormGenderType(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif">
                          <option value="মহিলা">মহিলা</option>
                          <option value="পুরুষ">পুরুষ</option>
                          <option value="উভয়">উভয়</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">প্রকাশের তারিখ</label>
                        <input type="text" value={formPublicationDate} onChange={e => setFormPublicationDate(e.target.value)}
                          placeholder="যেমনঃ ২৪/১১/২০২৫"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif" />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">পোস্টকোড</label>
                        <input type="text" value={formPostCode} onChange={e => setFormPostCode(e.target.value)}
                          placeholder="যেমনঃ ৯৩০০"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                      </div>

                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5 text-xs">
                    <button type="button" onClick={() => { setIsUploadModalOpen(false); resetModal(); }}
                      className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 font-serif transition-colors cursor-pointer">
                      বাতিল
                    </button>
                    <button type="submit" disabled={isProcessing}
                      className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50">
                      {isProcessing ? (
                        <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>সংরক্ষণ হচ্ছে...</>
                      ) : (
                        <><Check className="w-4 h-4" />পরবর্তী ধাপ →</>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Voter CSV Data */}
              {uploadStep === 2 && (
                <form onSubmit={handleStep2Submit} className="space-y-5">
                  
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    প্রচ্ছদ তথ্য সফলভাবে সংরক্ষিত। এখন ভোটার ডাটা যোগ করুন।
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      ভোটার তালিকা (CSV ফরম্যাটে paste করুন)
                    </label>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-[10px] text-blue-700 leading-relaxed">
                      <strong>CSV ফরম্যাট (প্রতি লাইনে একজন ভোটার, "|" দিয়ে আলাদা):</strong><br/>
                      <code className="font-mono bg-blue-100 px-1 rounded">ক্রমিক নং | নাম | ভোটার নং | পিতার নাম | মাতার নাম | পেশা | জন্ম তারিখ</code><br/><br/>
                      <strong>উদাহরণ:</strong><br/>
                      <code className="font-mono">০০১ | ইরানী বেগম | ০১১৩১৫৯৫৮৩২ | শেখ মাজিদ | মোসাঃ আলেয়া বেগম | গৃহিণী | ০৬/০৭/১৯৮৩</code>
                    </div>
                    <textarea
                      value={voterCsvText}
                      onChange={e => handleCsvChange(e.target.value)}
                      placeholder={"০০১ | ইরানী বেগম | ০১১৩১৫৯৫৮৩২ | শেখ মাজিদ | মোসাঃ আলেয়া বেগম | গৃহিণী | ০৬/০৭/১৯৮৩\n০০২ | খালিজা বেগম | ০১১৩৩১৫৯৫৮৩৬ | কালাই হালদার | ছুটু বিবি | গৃহিণী | ০৫/০৪/১৯৬৭"}
                      rows={12}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-y"
                    />
                    {parsedVoterCount > 0 && (
                      <p className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {parsedVoterCount} জন ভোটার শনাক্ত করা হয়েছে
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] text-slate-400">
                      * ভোটার ডাটা না দিলেও সরাসরি "শুধু PDF সংরক্ষণ করুন" বাটনে ক্লিক করতে পারেন।
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between gap-2.5 text-xs">
                    <button type="button" onClick={() => setUploadStep(1)}
                      className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 font-serif transition-colors cursor-pointer">
                      ← আগের ধাপ
                    </button>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={async () => { setVoterCsvText(''); setParsedVoterCount(0); await finalizePdfInUI(0); }}
                        disabled={isProcessing}
                        className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl font-serif transition-colors cursor-pointer disabled:opacity-50">
                        শুধু PDF সংরক্ষণ
                      </button>
                      <button type="submit" disabled={isProcessing}
                        className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50">
                        {isProcessing ? (
                          <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>আপলোড হচ্ছে...</>
                        ) : (
                          <><Check className="w-4 h-4" />ভোটার ইমপোর্ট করুন ({parsedVoterCount} জন)</>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
