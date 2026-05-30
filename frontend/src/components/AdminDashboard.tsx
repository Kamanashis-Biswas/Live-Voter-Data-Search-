import React, { useState, useRef } from 'react';
import { VoterRecord, UploadedPdf, SearchLog } from '../types';
import { 
  BarChart3, 
  Users, 
  Activity, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Globe, 
  ArrowUpRight, 
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
  ChevronRight
} from 'lucide-react';

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
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  voters, 
  uploadedPdfs, 
  setUploadedPdfs, 
  searchLogs,
  onAddVoter, 
  onRemoveVoter 
}) => {
  // Authentication State
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

  // Modal State for Uploading
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // New PDF Form State
  const [newPdfName, setNewPdfName] = useState<string>('');
  const [newPdfArea, setNewPdfArea] = useState<string>('');
  const [newPdfPage, setNewPdfPage] = useState<string>('');
  const [newPdfSize, setNewPdfSize] = useState<string>('৭.৪ MB');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setIsAuthProcessing(true);

    try {
      if (authMode === 'login') {
        const res = await fetch('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, password: passwordInput })
        });
        const data = await res.json();
        if (data.success) {
          setIsAuthenticated(true);
        } else {
          setAuthError(data.message || 'Login failed');
        }
      } else if (authMode === 'signup') {
        const res = await fetch('http://localhost:3000/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, password: passwordInput })
        });
        const data = await res.json();
        if (data.success) {
          setAuthSuccess('Signup successful. You can now login or verify email.');
          setAuthMode('login');
        } else {
          setAuthError(data.message || 'Signup failed');
        }
      } else if (authMode === 'forgot_password') {
        const res = await fetch('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput })
        });
        const data = await res.json();
        if (data.success) {
          setAuthSuccess('Password reset token sent to your email.');
          setAuthMode('reset_password');
        } else {
          setAuthError(data.message || 'Failed to send reset email');
        }
      } else if (authMode === 'reset_password') {
        const res = await fetch('http://localhost:3000/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, token: tokenInput, newPassword: passwordInput })
        });
        const data = await res.json();
        if (data.success) {
          setAuthSuccess('Password has been reset successfully. Please login.');
          setAuthMode('login');
          setTokenInput('');
          setPasswordInput('');
        } else {
          setAuthError(data.message || 'Failed to reset password');
        }
      }
    } catch (err) {
      setAuthError('Network error connecting to backend.');
    } finally {
      setIsAuthProcessing(false);
    }
  };

  // Pre-fill fields when user selects a file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPdfName(file.name);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setNewPdfSize(`${convertToBanglaNumber(sizeMb)} MB`);

      // Try parsing area and page number from file name
      const lowercaseName = file.name.toLowerCase();
      let areaGuess = '';
      if (lowercaseName.includes('সবুজপুর')) areaGuess = 'সবুজপুর';
      else if (lowercaseName.includes('লালবাগ')) areaGuess = 'লালবাগ';
      else if (lowercaseName.includes('আমতলী')) areaGuess = 'আমতলী';
      else if (lowercaseName.includes('সোনারগাঁও')) areaGuess = 'সোনারগাঁও';
      else {
        // Bengali word extraction matching
        const bengaliWords = file.name.match(/[\u0980-\u09FF]+/g);
        if (bengaliWords && bengaliWords.length > 0) {
          const filtered = bengaliWords.filter(w => !["তালিকা", "ভোটার", "পিডিএফ", "পৃষ্ঠা", "রোল"].includes(w));
          if (filtered.length > 0) areaGuess = filtered[0];
        }
      }
      setNewPdfArea(areaGuess || 'সবুজপুর');

      // Page extractor
      const numMatch = file.name.match(/\d+/);
      if (numMatch) {
         setNewPdfPage(convertToBanglaNumber(numMatch[0]));
      } else {
         setNewPdfPage('১২');
      }
    }
  };

  // Submit and fast-create matching voter records
  const handlePdfUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPdfName || !newPdfArea || !newPdfPage) {
      alert('অনুগ্রহ করে ফাইল সিলেক্ট করুন এবং সব তথ্য নির্ভুলভাবে দিন।');
      return;
    }

    setIsProcessing(true);

    // Simulate OCR processing time
    setTimeout(() => {
      const pageNumEn = newPdfPage;
      const areaVal = newPdfArea;
      
      const avatars = [
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150"
      ];

      // Auto-generate 3 realistic voters inside database associated with this PDF & Area
      const randNid = "১৯৯০৪১৫" + Math.floor(100000 + Math.random() * 900000);
      const randVoterId = "০৯৮৭১০" + Math.floor(1000 + Math.random() * 9000);

      const generatedVoters: VoterRecord[] = [
        {
          id: `V-AUTO-${Math.floor(100000 + Math.random() * 900000)}`,
          nid: randNid,
          voterNo: randVoterId,
          nameBn: areaVal === 'সবুজপুর' ? "মোঃ হাসানুজ্জামান শান্ত" : "মোঃ আশরাফুল আলম সরকার",
          nameEn: areaVal === 'সবুজপুর' ? "MD HASANUZZAMAN SHANTO" : "MD ASHRAFUL ALAM SARKAR",
          fatherName: "মোঃ মজিবুর রহমান",
          motherName: "মোসাম্মাৎ সালেহা খাতুন",
          dob: "1989-11-14",
          village: areaVal,
          gender: "পুরুষ",
          bloodGroup: "O+",
          photoUrl: avatars[Math.floor(Math.random() * avatars.length)],
          status: "সক্রিয়",
          page_number: pageNumEn,
          address: {
            village: areaVal,
            postOffice: `${areaVal} শাখা অফিস`,
            upazila: "কোতোয়ালী সদর",
            district: "ঢাকা"
          }
        },
        {
          id: `V-AUTO-${Math.floor(100000 + Math.random() * 900000)}`,
          nid: "১৯৯৪৫৮১" + Math.floor(100000 + Math.random() * 900000),
          voterNo: String(Number(randVoterId) + 1),
          nameBn: "মোসাম্মাৎ সুস্মিতা চৌধুরী",
          nameEn: "MOSAMMAT SUSMITA CHOWDHURY",
          fatherName: "চৌধুরী শামসুর রহমান",
          motherName: "আমেনা আক্তার সুইটি",
          dob: "1994-06-21",
          village: areaVal,
          gender: "মহিলা",
          bloodGroup: "B+",
          photoUrl: avatars[Math.floor(Math.random() * avatars.length)],
          status: "সক্রিয়",
          page_number: pageNumEn,
          address: {
            village: areaVal,
            postOffice: `${areaVal} পোস্টাল`,
            upazila: "কোতোয়ালী সদর",
            district: "ঢাকা"
          }
        },
        {
          id: `V-AUTO-${Math.floor(100000 + Math.random() * 900000)}`,
          nid: "১৯৯১২১৬" + Math.floor(100000 + Math.random() * 900000),
          voterNo: String(Number(randVoterId) + 2),
          nameBn: "বিপ্লব কুমার সূত্রধর",
          nameEn: "BIPLOB KUMAR SUTRADHAR",
          fatherName: "অনিল কুমার সূত্রধর",
          motherName: "গীতা রাণী সূত্রধর",
          dob: "1991-03-05",
          village: areaVal,
          gender: "পুরুষ",
          bloodGroup: "AB+",
          photoUrl: avatars[Math.floor(Math.random() * avatars.length)],
          status: "সক্রিয়",
          page_number: pageNumEn,
          address: {
            village: areaVal,
            postOffice: `${areaVal} বাজার`,
            upazila: "কোতোয়ালী সদর",
            district: "ঢাকা"
          }
        }
      ];

      // Add actual voters
      generatedVoters.forEach(voter => onAddVoter(voter));

      // Append to PDFs state
      const randomHash = "SHA-256: " + Array.from({length: 24}, () => Math.floor(Math.random()*16).toString(16)).join('');
      const newPdf: UploadedPdf = {
        id: `pdf-${Date.now()}`,
        fileName: newPdfName,
        fileSize: newPdfSize,
        uploadTime: "এইমাত্র",
        pageNumber: pageNumEn,
        detectedArea: areaVal,
        status: "সফল",
        integrityHash: randomHash,
        voterIds: generatedVoters.map(v => v.id)
      };

      setUploadedPdfs(prev => [newPdf, ...prev]);

      // Reset
      setNewPdfName('');
      setNewPdfArea('');
      setNewPdfPage('');
      setIsProcessing(false);
      setIsUploadModalOpen(false);

      alert(`সাফল্যের সাথে ভোটার পিডিএফ আপলোড হয়েছে! এবং ${areaVal} এলাকার ৩ জন ভোটারের ডিজিটাল ডাটা এক্সট্র্যাক্ট করে ভোটার পোর্টালে যুক্ত করা হয়েছে।`);
    }, 1500);
  };

  // Delete PDF record & remove associated voters
  const handleDeletePdf = (pdf: UploadedPdf) => {
    if (window.confirm(`আপনি কি সত্যিই "${pdf.fileName}" ফাইল এবং এর মাধ্যমে সিস্টেমে যুক্ত হওয়া ${pdf.voterIds.length} জন ভোটার ডাটা সম্পূর্ণ মুছে ফেলতে চান?`)) {
      pdf.voterIds.forEach(id => onRemoveVoter(id));
      setUploadedPdfs(prev => prev.filter(p => p.id !== pdf.id));
    }
  };

  // Auth Form
  if (!isAuthenticated) {
    return (
      <div id="admin-auth-panel" className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-xl text-center select-none animate-fade-in">
        <div className="w-16 h-16 bg-blue-50 text-blue-700 hover:text-blue-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 shadow-xs">
          <Lock className="w-7 h-7" />
        </div>
        
        <h2 className="text-xl font-bold text-slate-800 font-serif">অ্যাডমিন অ্যাক্সেস গেটওয়ে</h2>
        <p className="text-xs text-slate-500 mt-2">সংবেদনশীল ভোটার ডাটাবেজ সিস্টেম অ্যাক্সেস করতে লগইন করুন।</p>
        
        <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4 text-left">
          
          {(authMode === 'login' || authMode === 'signup' || authMode === 'forgot_password' || authMode === 'reset_password') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-1.5 font-mono">
                Email Address
              </label>
              <input 
                type="email" 
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm font-mono"
                required
              />
            </div>
          )}

          {authMode === 'reset_password' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-1.5 font-mono">
                Reset Token (OTP)
              </label>
              <input 
                type="text" 
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter token from email"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm font-mono"
                required
              />
            </div>
          )}

          {(authMode === 'login' || authMode === 'signup' || authMode === 'reset_password') && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest font-mono">
                  {authMode === 'reset_password' ? 'New Password' : 'Password'}
                </label>
                {authMode === 'login' && (
                  <button type="button" onClick={() => setAuthMode('forgot_password')} className="text-[10px] text-blue-600 hover:underline">
                    Forgot Password?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm font-mono"
                required
              />
            </div>
          )}

          {authError && (
            <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {authError}
            </p>
          )}

          {authSuccess && (
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {authSuccess}
            </p>
          )}

          <button 
            type="submit"
            disabled={isAuthProcessing}
            className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
          >
            {isAuthProcessing ? 'প্রসেসিং...' : (
              authMode === 'login' ? 'লগইন করুন' :
              authMode === 'signup' ? 'অ্যাকাউন্ট তৈরি করুন' :
              authMode === 'forgot_password' ? 'টোকেন পাঠান' :
              'পাসওয়ার্ড আপডেট করুন'
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

  return (
    <div id="admin-secured-dashboard" className="space-y-6 animate-fade-in text-slate-800">
      
      {/* Tab Selector Controls */}
      <div className="flex border-b border-slate-200 overflow-x-auto select-none no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'overview' 
              ? 'border-blue-700 text-blue-700 font-bold border-b-2 bg-blue-50/10' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          ওভারভিউ ড্যাশবোর্ড (Overview)
        </button>
        
        <button
          onClick={() => setActiveTab('pdf-list')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'pdf-list' 
              ? 'border-blue-700 text-blue-700 font-bold border-b-2 bg-blue-50/10' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          পিডিএফ আপলোড ও তালিকা (PDF Records & Upload)
        </button>

        <button
          onClick={() => setActiveTab('ip-logs')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'ip-logs' 
              ? 'border-blue-700 text-blue-700 font-bold border-b-2 bg-blue-50/10' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          ইউজার ট্রাফিক ও আইপি লগ (User Traffic & IP Logs)
        </button>
      </div>

      {/* Tab Content Display */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Statistical Metric Widget Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Metric 1 - Total Voters */}
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
                  {convertToBanglaNumber(voters.length)} জন
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  অ্যাক্টিভ ভোটার ইন্ডেক্স
                </p>
              </div>
            </div>

            {/* Metric 2 - Total Uploaded PDFs */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all">
              <div className="absolute right-[-15px] top-[-15px] w-24 h-24 bg-emerald-50 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-serif">মোট ভোটার পিডিএফ ফাইল</span>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 z-10">
                <h4 className="text-3xl font-black text-slate-900 tracking-tight font-sans">
                  {convertToBanglaNumber(uploadedPdfs.length)} টি
                </h4>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  লোকাল ডাটাবেজ সোর্স ফাইল
                </p>
              </div>
            </div>

            {/* Metric 3 - Search Logs size */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all">
              <div className="absolute right-[-15px] top-[-15px] w-24 h-24 bg-amber-50 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between z-10">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-serif">মোট অনুসন্ধান ট্রাফিক</span>
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
                <p className="text-[11px] text-slate-400 mt-1">
                  আইপি ট্র্যাকিং নোড চালু রয়েছে
                </p>
              </div>
            </div>

          </div>

          {/* Simple Informational Board */}
          <div className="p-6 bg-white rounded-xl border border-slate-200/80 flex flex-col md:flex-row shadow-xs items-center gap-6 justify-between">
            <div className="space-y-2 max-w-2xl text-left">
              <h3 className="text-base font-bold text-slate-900 font-serif flex items-center gap-1.5">
                <Unlock className="w-5 h-5 text-blue-700" />
                অ্যাডমিন ডাইরেক্টরি ওভারভিউ ও ড্যাশবোর্ড নিরাপত্তা
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                আপনাকে লোকাল অ্যাডমিন প্যানেলে স্বাগত জানানো হচ্ছে। সংবেদনশীল ভোটার ডাটাবেজে আপনার যুক্ত করা ভোটার গ্যাজেট পিডিএফ রোলসমূহ এই সেশন কন্ট্রোল প্যানেলে মেমোরি সংরক্ষণ করে। কোনো ভোটার বা পিডিএফ নথি মুছে ফেলার পর ভোটার ডিক্রি পুনরায় গ্লোবাল স্পেসে অ্যাক্সেস করা সম্ভব নয় এবং এটি লোকাল কম্পিউটার সেশনের গোপনীয়তায় বজায় থাকে।
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shrink-0 text-center flex flex-col justify-center min-w-[200px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-widest text-center">লোকাল লাইসেন্স</span>
              <span className="text-lg font-black text-slate-800 font-serif mt-1">LOCAL-NODE-ACTIVE</span>
              <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block mx-auto px-2 py-0.5 bg-emerald-50 rounded border border-emerald-100">
                নিরাপদ ৩.০ সচল
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: PDF File list & Upload hub */}
      {activeTab === 'pdf-list' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs select-none">
            <div className="text-left">
              <h2 className="text-base font-bold text-slate-800 font-serif flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-700" />
                সক্রিয় ভোটার রোল পিডিএফ ফাইল ({convertToBanglaNumber(uploadedPdfs.length)} টি ফাইল)
              </h2>
              <p className="text-xs text-slate-400">আপলোডকৃত গ্যাজেট পিডিএফের রেকর্ড ক্যাশ এবং ভোটার ইন্টিগ্রিটি ম্যাপিং</p>
            </div>

            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-100 font-serif"
            >
              <Plus className="w-4 h-4" />
              নতুন ভোটার পিডিএফ বা রোল আপলোড করুন
            </button>
          </div>

          {/* PDF files listing in standard gorgeous Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase border-b border-slate-100 font-bold select-none font-serif">
                    <th className="p-4">ভোটার পিডিএফের ফাইল নাম (File Name)</th>
                    <th className="p-4">আকার (Size)</th>
                    <th className="p-4">নি নির্বাচনী এলাকা/গ্রাম (Detected Area)</th>
                    <th className="p-4">গ্যাজেট পৃষ্ঠা নং (Page Number)</th>
                    <th className="p-4 text-center">সংযুক্ত ভোটার সংখ্যা (Voters Added)</th>
                    <th className="p-4 text-center">স্ট্যাটাস (Status)</th>
                    <th className="p-4 text-center">অ্যাকশন (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {uploadedPdfs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-medium font-serif">
                        কোনো ভোটার পিডিএফ ফাইল আপলোড করা হয়নি। উপরে <strong>"নতুন ভোটার পিডিএফ বা রোল আপলোড করুন"</strong> বাটনে ক্লিক করে ফাইল আপলোড করুন।
                      </td>
                    </tr>
                  ) : (
                    uploadedPdfs.map((pdf) => (
                      <tr key={pdf.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2 max-w-md">
                            <FileText className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate" title={pdf.fileName}>
                              {pdf.fileName}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 font-mono text-xs">{pdf.fileSize}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold font-serif">
                            {pdf.detectedArea}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 font-mono text-xs">{pdf.pageNumber} নং</td>
                        <td className="p-4 text-center font-bold text-slate-900">
                          {convertToBanglaNumber(pdf.voterIds.length)} জন ভোটার
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            সফল
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleDeletePdf(pdf)}
                            className="p-1 px-2.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 rounded-lg flex items-center gap-1 mx-auto font-serif transition-colors cursor-pointer font-bold"
                            title="ফাইল ও তথ্য ডিলিট"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            মুছে ফেলুন
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Simple static notes under table */}
          <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed text-left">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              <strong>পিডিএফ নিষ্কাশন গাইডলাইন:</strong> ব্যক্তিগত ভোটার ফাইল আপলোড করার সময় সিস্টেম স্বয়ংক্রিয়ভাবে একটি ইউনিক ডিজিটাল সিগনেচার হ্যাশ গণনা করে। আপলোড সমাপ্ত হওয়ার সাথে সাথে টেস্ট ডাটাবেজ সোর্স হিসাবে নতুন ৩ জন ভোটারের সম্পূর্ণ বিশদ ফর্মের ডাটা পোর্টাল ডিরেক্টরিতে ইনজেক্ট হয়, যা হোমপেজে সার্চের সময় instant প্রদর্শিত হবে।
            </p>
          </div>

        </div>
      )}

      {/* Tab 3: Recent searches / User IP logs */}
      {activeTab === 'ip-logs' && (
        <div className="space-y-6 animate-fade-in font-sans">
          
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 select-none text-left">
            <div>
              <h2 className="text-base font-bold text-slate-800 font-serif">অনুসন্ধান ট্রাফিক আইপি ডাটাবেজ (System Search logs IP Tracker)</h2>
              <p className="text-xs text-slate-400">রিয়েল-টাইমে সাইট ব্যবহারকারী ও ভোটার ডাটা অনুসন্ধানকারীদের হোস্ট নোড বিশ্লেষণ</p>
            </div>
            
            <span className="text-xs font-semibold px-2.5 py-1 text-slate-600 bg-slate-100 rounded-lg border border-slate-200">
              সার্বক্ষণিক লাইভ সেশন ম্যাপযুক্ত
            </span>
          </div>

          {/* High density clean table log showing user queries */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase border-b border-slate-100 font-bold select-none font-serif">
                    <th className="p-4">তারিখ ও সময় (Date & Time)</th>
                    <th className="p-4">আইপি ঠিকানা (IP Address)</th>
                    <th className="p-4">সার্চ ক্যাটাগরি (Scope)</th>
                    <th className="p-4">অনুসন্ধান কোয়েরি (Search Terms)</th>
                    <th className="p-4">পদ্ধতি গতি (Latency)</th>
                    <th className="p-4 text-center">ফলাফল অবস্থা (Status)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {searchLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 font-medium font-serif">
                        কোনো ভোটার অনুসন্ধান করার রেকর্ড পাওয়া যায়নি। হোম স্ক্রিনে ভোটার পোর্টাল সার্চ করুন।
                      </td>
                    </tr>
                  ) : (
                    searchLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-slate-500 font-mono text-xs">{log.dateTime}</td>
                        <td className="p-4">
                          <code className="bg-slate-100 text-slate-800 border border-slate-200/60 font-mono text-xs px-2 py-0.5 rounded">
                            {log.ipAddress}
                          </code>
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-[10px] font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-blue-700 rounded select-none">
                            {log.method}
                          </span>
                        </td>
                        <td className="p-4 text-slate-800 font-serif font-semibold truncate max-w-xs" title={log.query}>
                          {log.query}
                        </td>
                        <td className="p-4 text-slate-400 font-mono text-xs font-semibold">{log.responseTime}</td>
                        <td className="p-4 text-center select-none">
                          {log.status === 'Success' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                              <Check className="w-3.5 h-3.5 text-emerald-600 font-black" />
                              FOUND
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-250/50">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              EMPTY
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination design element */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 select-none font-medium text-left">
              <p>প্রদর্শিত হচ্ছে <strong className="text-slate-800 font-mono">{convertToBanglaNumber(1)}-{convertToBanglaNumber(Math.min(searchLogs.length, 10))}</strong> মোট <strong className="text-slate-800 font-mono">{convertToBanglaNumber(searchLogs.length)}</strong> টি সার্চ নোড এন্ট্রি থেকে</p>
              
              <div className="flex items-center gap-2">
                <button className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50" disabled>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button className="px-2.5 py-1 border border-slate-300 rounded-lg bg-blue-600 text-white font-bold font-mono">১</button>
                <button className="p-2 border border-slate-200 rounded-lg bg-white text-slate-500 hover:text-slate-800 transition-colors" disabled>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* --- RENDER UPLOAD MODAL DIALOG --- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 text-left overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 select-none">
              <h3 className="text-base font-bold text-slate-900 font-serif flex items-center gap-1.5">
                <UploadCloud className="w-5 h-5 text-blue-700" />
                ভোটার তালিকা পিডিএফ আপলোডার
              </h3>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-150 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload Modal Form */}
            <form onSubmit={handlePdfUploadSubmit} className="space-y-4">
              
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  ১. ভোটার তালিকা পিডিএফ রোল সিলেক্ট করুন (PDF Target)*
                </label>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-slate-100 rounded-xl p-5 text-center cursor-pointer transition-colors"
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf"
                    className="hidden"
                    required={!newPdfName}
                  />
                  
                  {newPdfName ? (
                    <div className="space-y-2">
                      <FileCheck className="w-8 h-8 text-emerald-600 mx-auto" />
                      <p className="text-xs font-bold text-slate-800 break-all">{newPdfName}</p>
                      <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full font-serif">
                        ফাইল সংযুক্ত করা হয়েছে
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-slate-500">
                      <UploadCloud className="w-8 h-8 text-blue-700 mx-auto animate-bounce" />
                      <p className="text-xs font-semibold">ক্লিক করে আপনার উপজেলা বা ভোটার তালিকা চাট গ্যাজেট পিডিএফ ফাইলটি এড করুন</p>
                      <p className="text-[10px]">সমর্থিত ফাইল: .pdf • সর্বোচ্চ সীমা: ৩৫ MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Input fields */}
              <div className="grid grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-serif">
                    ২. নির্বাচনী এলাকা বা গ্রাম (Area/Village)*
                  </label>
                  <input 
                    type="text" 
                    value={newPdfArea}
                    onChange={(e) => setNewPdfArea(e.target.value)}
                    placeholder="যেমনঃ সবুজপুর"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-serif">
                    ৩. ভোটার গ্যাজেট পৃষ্ঠা নং*
                  </label>
                  <input 
                    type="text" 
                    value={newPdfPage}
                    onChange={(e) => setNewPdfPage(e.target.value)}
                    placeholder="যেমনঃ ৪৫"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-serif"
                    required
                  />
                </div>

              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5 select-none text-xs">
                <button 
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-505 rounded-xl hover:bg-slate-50 font-serif transition-colors cursor-pointer"
                >
                  বাতিল করুন
                </button>
                
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      তথ্য ভেরিফাই ও সিঙ্ক হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      সংরক্ষণ ও এক্সট্র্যাক্ট করুন
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
