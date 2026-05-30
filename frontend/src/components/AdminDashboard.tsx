import React, { useState, useRef } from 'react';
import { VoterRecord, UploadedPdf, SearchLog } from '../types';
import { 
  Activity, CheckCircle2, XCircle, AlertCircle, Globe, 
  UploadCloud, Database, Lock, Unlock, FileText, Trash2, 
  X, Plus, FileCheck, Check, Info, ChevronLeft, ChevronRight,
  MapPin, RefreshCw, UserCheck, Eye, EyeOff, Copy
} from 'lucide-react';

// API base URL — matches backend port defined in backend/.env
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

const toBangla = (n: number | string): string => {
  const d = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  return String(n).split('').map(c => { const i = parseInt(c); return isNaN(i) ? c : d[i]; }).join('');
};

interface AdminDashboardProps {
  voters: VoterRecord[];
  uploadedPdfs: UploadedPdf[];
  setUploadedPdfs: React.Dispatch<React.SetStateAction<UploadedPdf[]>>;
  searchLogs: SearchLog[];
  onAddVoter: (v: VoterRecord) => void;
  onRemoveVoter: (id: string) => void;
  onRefreshPdfs: () => void;
  totalVotersInSystem: number;
  pdfsLoading: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  voters, uploadedPdfs, setUploadedPdfs, searchLogs,
  onAddVoter, onRemoveVoter, onRefreshPdfs, totalVotersInSystem, pdfsLoading
}) => {
  // Auth
  const [isAuth, setIsAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login'|'signup'|'forgot_password'|'reset_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [authOk, setAuthOk] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');

  // Tabs
  const [tab, setTab] = useState<'overview'|'pdf-list'|'ip-logs'>('overview');

  // Upload
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadErr, setUploadErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Auth submit
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr(''); setAuthOk(''); setAuthBusy(true);
    try {
      if (authMode === 'login') {
        const r = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password}) });
        const d = await r.json();
        if (d.success) setIsAuth(true); else setAuthErr(d.message || 'Login failed');
      } else if (authMode === 'signup') {
        const r = await fetch(`${API_BASE}/api/auth/signup`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password}) });
        const d = await r.json();
        if (d.success) { setAuthOk('Signup successful. Now login.'); setAuthMode('login'); } else setAuthErr(d.message || 'Signup failed');
      } else if (authMode === 'forgot_password') {
        const r = await fetch(`${API_BASE}/api/auth/forgot-password`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email}) });
        const d = await r.json();
        if (d.success) { 
          if (d.token) {
            setGeneratedToken(d.token);
            setAuthOk('টোকেন জেনারেট হয়েছে।');
          } else {
            setAuthOk('Token sent/generated.'); 
          }
          setAuthMode('reset_password'); 
        } else {
          setAuthErr(d.message || 'Failed');
        }
      } else {
        const r = await fetch(`${API_BASE}/api/auth/reset-password`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, token, newPassword: password}) });
        const d = await r.json();
        if (d.success) { setAuthOk('Password reset. Login now.'); setAuthMode('login'); setGeneratedToken(''); setToken(''); } else setAuthErr(d.message || 'Failed');
      }
    } catch { setAuthErr('Network error.'); }
    setAuthBusy(false);
  };

  // File upload — actual PDF sent to backend
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setUploadErr('PDF ফাইল সিলেক্ট করুন।'); return; }
    setUploading(true); setUploadErr(''); setUploadMsg('');
    try {
      const form = new FormData();
      form.append('pdfFile', selectedFile);
      const r = await fetch(`${API_BASE}/api/pdf/upload`, { method: 'POST', body: form });
      const d = await r.json();
      if (d.success) {
        setUploadMsg(d.message);
        await onRefreshPdfs();
        setTimeout(() => { setModalOpen(false); setSelectedFile(null); setUploadMsg(''); }, 2000);
      } else {
        setUploadErr(d.error?.message || d.message || 'Upload failed');
      }
    } catch (err: any) {
      setUploadErr('Network error: ' + err.message);
    }
    setUploading(false);
  };

  const handleDeletePdf = async (pdf: UploadedPdf) => {
    if (!confirm(`"${pdf.fileName}" এবং এর ভোটার ডাটা মুছে ফেলবেন?`)) return;
    await fetch(`${API_BASE}/api/pdf/${pdf.id}`, { method: 'DELETE' });
    setUploadedPdfs(prev => prev.filter(p => p.id !== pdf.id));
  };

  if (!isAuth) return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-xl text-center">
      <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100">
        <Lock className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 font-serif">অ্যাডমিন অ্যাক্সেস</h2>
      
      {generatedToken && (
        <div className="mt-6 mb-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-left">
          <div>
            <p className="text-xs font-bold text-emerald-800 mb-1">আপনার টোকেন:</p>
            <p className="text-xl font-mono font-bold text-emerald-600 tracking-widest">{generatedToken}</p>
          </div>
          <button 
            type="button"
            onClick={() => { navigator.clipboard.writeText(generatedToken); alert('টোকেন কপি করা হয়েছে!'); }}
            className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg flex flex-col items-center gap-1 transition-colors"
            title="Copy Token"
          >
            <Copy className="w-5 h-5" />
            <span className="text-[9px] font-bold">কপি করুন</span>
          </button>
        </div>
      )}

      <form onSubmit={handleAuth} className="mt-6 space-y-4 text-left">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-widest font-mono">Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com" required className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"/>
        </div>
        {authMode === 'reset_password' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-widest font-mono">Reset Token</label>
            <input type="text" value={token} onChange={e=>setToken(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"/>
          </div>
        )}
        {(authMode==='login'||authMode==='signup'||authMode==='reset_password') && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest font-mono">{authMode==='reset_password'?'New Password':'Password'}</label>
              {authMode==='login' && <button type="button" onClick={()=>{setAuthMode('forgot_password'); setGeneratedToken(''); setAuthOk(''); setAuthErr('');}} className="text-[10px] text-blue-600 hover:underline">Forgot?</button>}
            </div>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
        {authErr && <p className="text-xs text-rose-600 flex items-center gap-1.5 bg-rose-50 p-2.5 rounded-lg border border-rose-100"><AlertCircle className="w-4 h-4 shrink-0"/>{authErr}</p>}
        {authOk && <p className="text-xs text-emerald-600 flex items-center gap-1.5 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100"><CheckCircle2 className="w-4 h-4 shrink-0"/>{authOk}</p>}
        <button type="submit" disabled={authBusy} className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-sm disabled:opacity-50">
          {authBusy ? 'প্রসেসিং...' : authMode==='login' ? 'লগইন' : authMode==='signup' ? 'সাইন আপ' : authMode==='forgot_password' ? 'টোকেন পাঠান' : 'পাসওয়ার্ড রিসেট'}
        </button>
      </form>
      <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
        {authMode==='login' ? <p>নেই? <button onClick={()=>setAuthMode('signup')} className="text-blue-600 font-bold hover:underline">সাইন আপ</button></p> : <p><button onClick={()=>setAuthMode('login')} className="text-blue-600 font-bold hover:underline">লগইনে ফিরুন</button></p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 text-slate-800">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
        {[{k:'overview',l:'ওভারভিউ',i:<Activity className="w-4 h-4"/>},{k:'pdf-list',l:'PDF আপলোড',i:<UploadCloud className="w-4 h-4"/>},{k:'ip-logs',l:'সার্চ লগ',i:<Globe className="w-4 h-4"/>}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} className={`px-5 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${tab===t.k?'border-blue-700 text-blue-700 bg-blue-50/10':'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t.i}{t.l}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab==='overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {label:'সিস্টেমের মোট ভোটার',val:`${toBangla(totalVotersInSystem)} জন`,icon:<Database className="w-5 h-5"/>,color:'blue',sub:'লোকাল ডাটাবেজ'},
              {label:'আপলোডকৃত PDF',val:`${toBangla(uploadedPdfs.length)} টি`,icon:<FileText className="w-5 h-5"/>,color:'emerald',sub:'সিস্টেমে যুক্ত'},
              {label:'মোট অনুসন্ধান',val:`${toBangla(searchLogs.length)} বার`,icon:<Globe className="w-5 h-5"/>,color:'amber',sub:'এই সেশনে'},
            ].map((c,i)=>(
              <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{c.label}</span>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    c.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                    c.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>{c.icon}</div>
                </div>
                <h4 className="text-3xl font-black text-slate-900 mt-4">{pdfsLoading ? '...' : c.val}</h4>
                <p className="text-[11px] text-slate-400 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {uploadedPdfs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-6">
              <h3 className="font-bold text-slate-800 font-serif flex items-center gap-2 mb-4"><MapPin className="w-4 h-4 text-blue-700"/>আপলোডকৃত এলাকার সারসংক্ষেপ</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {uploadedPdfs.map(p=>(
                  <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-bold text-slate-800 truncate">{p.fileName}</p>
                    <p className="text-slate-500">{p.district} › {p.upazila} › {p.unionName}</p>
                    <p className="text-slate-500">ভোটার এলাকা: <span className="font-semibold text-slate-700">{p.voterArea}</span> ({p.voterAreaNo})</p>
                    <p className="text-slate-500">সর্বমোট: {p.totalVoters} | {p.genderType}: {p.genderType==='মহিলা'?p.totalFemaleVoters:p.totalVoters}</p>
                    <div className="flex gap-1 mt-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${p.genderType==='মহিলা'?'bg-pink-50 border-pink-100 text-pink-700':'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>{p.genderType}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 border-emerald-100 text-emerald-700 text-[10px] font-bold"><UserCheck className="w-3 h-3 inline mr-0.5"/>{p.voterCount} extract</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6 bg-white rounded-xl border border-slate-200/80 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="space-y-2 max-w-2xl">
              <h3 className="text-base font-bold text-slate-900 font-serif flex items-center gap-1.5"><Unlock className="w-5 h-5 text-blue-700"/>Local Storage Mode — কোনো Supabase Setup লাগবে না</h3>
              <p className="text-xs text-slate-500 leading-relaxed">PDF আপলোড করলে সার্ভার স্বয়ংক্রিয়ভাবে ভোটারদের তথ্য extract করে local database-এ সংরক্ষণ করে। তারপর নাম, পিতার নাম, গ্রামের নাম দিয়ে তাৎক্ষণিক অনুসন্ধান করা যাবে।</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shrink-0 text-center min-w-[180px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">Storage</span>
              <p className="text-lg font-black text-slate-800 font-serif mt-1">LOCAL JSON</p>
              <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block px-2 py-0.5 bg-emerald-50 rounded border border-emerald-100">সক্রিয়</span>
            </div>
          </div>
        </div>
      )}

      {/* PDF LIST */}
      {tab==='pdf-list' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-800 font-serif flex items-center gap-2"><Database className="w-4 h-4 text-blue-700"/>ভোটার তালিকা PDF ({toBangla(uploadedPdfs.length)} টি)</h2>
              <p className="text-xs text-slate-400">PDF আপলোড করলে স্বয়ংক্রিয়ভাবে ভোটার তথ্য extract হবে</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onRefreshPdfs} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 cursor-pointer">
                <RefreshCw className={`w-3.5 h-3.5 ${pdfsLoading?'animate-spin':''}`}/>রিফ্রেশ
              </button>
              <button onClick={()=>setModalOpen(true)} className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 shadow-md cursor-pointer">
                <Plus className="w-4 h-4"/>PDF আপলোড করুন
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase border-b border-slate-100 font-bold font-serif">
                    {['ফাইল নাম','জেলা','উপজেলা','ইউনিয়ন','ভোটার এলাকা','এলাকা নং','মোট ভোটার','Extract','ধরন','তারিখ','অ্যাকশন'].map(h=><th key={h} className="p-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pdfsLoading ? (
                    <tr><td colSpan={11} className="p-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2"/>লোড হচ্ছে...</td></tr>
                  ) : uploadedPdfs.length === 0 ? (
                    <tr><td colSpan={11} className="p-12 text-center text-slate-400">
                      <UploadCloud className="w-10 h-10 mx-auto mb-3 text-slate-300"/>
                      কোনো PDF নেই। উপরে "PDF আপলোড করুন" ক্লিক করুন।
                    </td></tr>
                  ) : uploadedPdfs.map(pdf=>(
                    <tr key={pdf.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 max-w-[160px]"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-red-600 shrink-0"/><span className="font-semibold text-slate-800 truncate text-[11px]" title={pdf.fileName}>{pdf.fileName}</span></div></td>
                      <td className="p-3 font-serif">{pdf.district}</td>
                      <td className="p-3 font-serif">{pdf.upazila}</td>
                      <td className="p-3 font-serif text-slate-600">{pdf.unionName||'-'}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-700 font-bold">{pdf.voterArea||'-'}</span></td>
                      <td className="p-3 font-mono text-slate-600">{pdf.voterAreaNo||'-'}</td>
                      <td className="p-3 text-center font-bold">{pdf.totalVoters||'-'}</td>
                      <td className="p-3 text-center"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"><UserCheck className="w-3 h-3"/>{pdf.voterCount} জন</span></td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${pdf.genderType==='মহিলা'?'bg-pink-50 border-pink-100 text-pink-700':'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>{pdf.genderType}</span></td>
                      <td className="p-3 text-[10px] font-mono text-slate-500">{pdf.publicationDate||'-'}</td>
                      <td className="p-3 text-center">
                        <button onClick={()=>handleDeletePdf(pdf)} className="p-1 px-2.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg flex items-center gap-1 mx-auto font-bold cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5"/>মুছুন
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
            <Info className="w-4 h-4 shrink-0 mt-0.5"/>
            <p><strong>কিভাবে কাজ করে:</strong> আপনার ভোটার তালিকার PDF আপলোড করুন → backend স্বয়ংক্রিয়ভাবে সকল ভোটারের নাম, পিতা, মাতা, ভোটার নং, পেশা, জন্মতারিখ extract করবে → পাবলিক পোর্টালে search করলে সঙ্গে সঙ্গে ফলাফল আসবে → Verify বাটনে ক্লিক করলে আসল PDF-এর সেই পাতায় ভোটারের তথ্য highlighted দেখাবে।</p>
          </div>
        </div>
      )}

      {/* IP LOGS */}
      {tab==='ip-logs' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <div><h2 className="text-base font-bold text-slate-800 font-serif">সার্চ লগ</h2><p className="text-xs text-slate-400">এই সেশনের অনুসন্ধান কার্যক্রম</p></div>
            <span className="text-xs font-semibold px-2.5 py-1 text-slate-600 bg-slate-100 rounded-lg border border-slate-200">সেশন ট্র্যাকিং</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="bg-slate-50 text-slate-600 uppercase border-b border-slate-100 font-bold font-serif">
                  {['সময়','IP','পদ্ধতি','কোয়েরি','লেটেন্সি','স্ট্যাটাস'].map(h=><th key={h} className="p-4">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {searchLogs.length===0 ? <tr><td colSpan={6} className="p-12 text-center text-slate-400">এখনো কোনো অনুসন্ধান হয়নি।</td></tr> : searchLogs.slice(0,20).map(log=>(
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-mono text-slate-500">{log.dateTime}</td>
                      <td className="p-4"><code className="bg-slate-100 text-slate-800 font-mono px-2 py-0.5 rounded">{log.ipAddress}</code></td>
                      <td className="p-4"><span className="font-mono text-[10px] font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-blue-700 rounded">{log.method}</span></td>
                      <td className="p-4 font-serif font-semibold truncate max-w-xs">{log.query}</td>
                      <td className="p-4 font-mono text-slate-400">{log.responseTime}</td>
                      <td className="p-4 text-center">
                        {log.status==='Success'?<span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><Check className="w-3 h-3"/>FOUND</span>:<span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200"><XCircle className="w-3 h-3"/>EMPTY</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <p>মোট <strong className="font-mono">{searchLogs.length}</strong> টি সার্চ</p>
              <div className="flex items-center gap-2">
                <button className="p-2 border border-slate-200 rounded-lg bg-white text-slate-400" disabled><ChevronLeft className="w-3.5 h-3.5"/></button>
                <button className="px-2.5 py-1 border border-slate-300 rounded-lg bg-blue-600 text-white font-bold font-mono">১</button>
                <button className="p-2 border border-slate-200 rounded-lg bg-white text-slate-500" disabled><ChevronRight className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="text-base font-bold text-slate-900 font-serif flex items-center gap-1.5"><UploadCloud className="w-5 h-5 text-blue-700"/>ভোটার তালিকা PDF আপলোড</h3>
              <button onClick={()=>{setModalOpen(false);setSelectedFile(null);setUploadErr('');setUploadMsg('');}} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleUpload} className="p-5 space-y-4">
              <div onClick={()=>fileRef.current?.click()} className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-slate-100 rounded-xl p-6 text-center cursor-pointer transition-colors">
                <input type="file" ref={fileRef} accept=".pdf" className="hidden" onChange={e=>{ if(e.target.files?.[0]) setSelectedFile(e.target.files[0]); }}/>
                {selectedFile ? (
                  <div className="space-y-1">
                    <FileCheck className="w-8 h-8 text-emerald-600 mx-auto"/>
                    <p className="text-sm font-bold text-slate-800 break-all">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{(selectedFile.size/1024/1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="text-slate-500 space-y-2">
                    <UploadCloud className="w-10 h-10 text-blue-600 mx-auto animate-bounce"/>
                    <p className="text-sm font-semibold">ক্লিক করে PDF সিলেক্ট করুন</p>
                    <p className="text-xs">.pdf • সর্বোচ্চ ৫০ MB</p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>স্বয়ংক্রিয় extract হবে:</strong> নির্বাচন কমিশনের ভোটার তালিকা PDF আপলোড করুন। সার্ভার নিজেই সকল ভোটারের নাম, পিতা, মাতা, ভোটার নম্বর, পেশা, জন্মতারিখ বের করে নেবে।
              </div>

              {uploadErr && <p className="text-xs text-rose-600 flex items-center gap-1.5 bg-rose-50 p-3 rounded-lg border border-rose-100"><AlertCircle className="w-4 h-4 shrink-0"/>{uploadErr}</p>}
              {uploadMsg && <p className="text-xs text-emerald-700 flex items-center gap-1.5 bg-emerald-50 p-3 rounded-lg border border-emerald-100"><CheckCircle2 className="w-4 h-4 shrink-0"/>{uploadMsg}</p>}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5 text-xs">
                <button type="button" onClick={()=>{setModalOpen(false);setSelectedFile(null);setUploadErr('');}} className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 cursor-pointer">বাতিল</button>
                <button type="submit" disabled={uploading||!selectedFile} className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
                  {uploading ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Extract হচ্ছে...</> : <><Check className="w-4 h-4"/>আপলোড ও Extract করুন</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
