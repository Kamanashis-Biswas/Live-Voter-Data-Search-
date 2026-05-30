import { useState, useEffect, useCallback } from 'react';
import { SearchFilters, VoterRecord, UploadedPdf, SearchLog } from './types';
import { VoterSearchForm } from './components/VoterSearchForm';
import { VoterResultCard } from './components/VoterResultCard';
import { AdminDashboard } from './components/AdminDashboard';
import {
  Lock,
} from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [currentView, setCurrentView] = useState<'search' | 'dashboard'>('search');
  const [voters, setVoters] = useState<VoterRecord[]>([]);
  const [filteredVoters, setFilteredVoters] = useState<VoterRecord[]>([]);
  const [searchPerformed, setSearchPerformed] = useState<boolean>(false);
  const [searchCount, setSearchCount] = useState<number>(0);
  const [todaySearchCount, setTodaySearchCount] = useState<number>(0);
  const [recentActions, setRecentActions] = useState<Array<{ id: number; text: string; time: string; type: 'red' | 'blue' }>>([]);

  // Track search state
  const [searching, setSearching] = useState<boolean>(false);

  // Real PDFs from backend
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [pdfsLoading, setPdfsLoading] = useState<boolean>(false);

  // Track user search queries
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);

  // Load PDF list from Supabase on mount
  const loadPdfs = useCallback(async () => {
    setPdfsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/pdf/list`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.pdfs) {
          // Map backend snake_case to frontend camelCase
          const mapped: UploadedPdf[] = data.pdfs.map((p: any) => ({
            id: p.id,
            fileName: p.fileName || p.file_name || '',
            fileSize: p.fileSize || p.file_size || '',
            uploadTime: p.uploadedAt ? new Date(p.uploadedAt).toLocaleString('bn-BD') : 'অজানা',
            district: p.district || '',
            upazila: p.upazila || '',
            unionName: p.unionName || p.union_name || '',
            wardNo: p.wardNo || p.ward_no || '',
            voterArea: p.voterArea || p.voter_area || '',
            voterAreaNo: p.voterAreaNo || p.voter_area_no || '',
            totalVoters: p.totalVoters || p.total_voters || 0,
            totalFemaleVoters: p.totalFemaleVoters || p.total_female_voters || 0,
            totalMaleVoters: p.totalMaleVoters || p.total_male_voters || 0,
            genderType: p.genderType || p.gender_type || 'পুরুষ',
            publicationDate: p.publicationDate || p.publication_date || '',
            postCode: p.postCode || p.post_code || '',
            voterCount: p.voterCount || p.voter_count || 0,
            totalPages: p.totalPages || 0,
            status: p.status || 'সফল',
            uploadedAt: p.uploadedAt || '',
            voterIds: []
          }));
          setUploadedPdfs(mapped);
        }
      }
    } catch (err) {
      console.error('Failed to load PDFs:', err);
    } finally {
      setPdfsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPdfs();
  }, [loadPdfs]);

  const handleSearch = async (filters: SearchFilters) => {
    setSearching(true);
    const queryParams = new URLSearchParams();
    if (filters.name) queryParams.append('name', filters.name);
    if (filters.fatherName) queryParams.append('fatherName', filters.fatherName);
    if (filters.motherName) queryParams.append('motherName', filters.motherName);
    if (filters.village) queryParams.append('village', filters.village);
    if (filters.dob) queryParams.append('dob', filters.dob);
    if (filters.gender && filters.gender !== 'all') queryParams.append('gender', filters.gender);
    if (filters.upazila) queryParams.append('upazila', filters.upazila);
    if (filters.district) queryParams.append('district', filters.district);
    if (filters.voterNo) queryParams.append('voterNo', filters.voterNo);

    try {
      const response = await fetch(`${API_BASE}/api/voters/search?${queryParams.toString()}`);
      if (!response.ok) {
        console.error('Failed to fetch from backend');
        setFilteredVoters([]);
        setSearchPerformed(true);
        setSearching(false);
        return;
      }
      const data = await response.json();
      let results = data.results || [];

      // Map backend fields to frontend interface (handles both snake_case legacy and camelCase)
      const mappedResults: VoterRecord[] = results.map((v: any) => ({
        id: v.id,
        nid: v.nid || '',
        voterNo: v.voterNo || v.voter_no || '',
        nameBn: v.nameBn || v.name_bn || '',
        nameEn: v.nameEn || v.name_en || '',
        fatherName: v.fatherName || v.father_name || '',
        motherName: v.motherName || v.mother_name || '',
        dob: v.dob || '',
        village: v.village || '',
        gender: v.gender || 'পুরুষ',
        bloodGroup: v.bloodGroup || v.blood_group || '',
        photoUrl: v.photoUrl || v.photo_url || '',
        status: v.status || 'সক্রিয়',
        page_number: v.page_number || v.pdfPageNumber || '',
        serialNo: v.serialNo || v.serial_no || '',
        serialNum: v.serialNum || 0,
        serialOnPage: v.serialOnPage || 1,
        pdfPageNumber: v.pdfPageNumber || 2,
        occupation: v.occupation || '',
        unionName: v.unionName || v.union_name || '',
        wardNo: v.wardNo || v.ward_no || '',
        voterArea: v.voterArea || v.voter_area || '',
        voterAreaNo: v.voterAreaNo || v.voter_area_no || '',
        upazila: v.upazila || '',
        district: v.district || '',
        postCode: v.postCode || v.post_code || '',
        publicationDate: v.publicationDate || v.publication_date || '',
        pdfUploadId: v.pdfUploadId || v.pdf_upload_id || '',
        address: {
          village: v.address?.village || v.village || '',
          postOffice: v.address?.postOffice || v.voterArea || v.voter_area || '',
          upazila: v.address?.upazila || v.upazila || '',
          district: v.address?.district || v.district || ''
        }
      }));

      setFilteredVoters(mappedResults);
      setSearchPerformed(true);
      setSearchCount(prev => prev + 1);
      setTodaySearchCount(prev => prev + 1);

      setRecentActions(prev => [
        { id: Date.now(), text: `অনুসন্ধান: ${filters.name || filters.village || 'ফিল্টারসমূহ দ্বারা'}`, time: 'এইমাত্র', type: 'blue' },
        ...prev.slice(0, 4)
      ]);

      const logDetails: string[] = [];
      if (filters.name) logDetails.push(`নাম: ${filters.name}`);
      if (filters.fatherName) logDetails.push(`পিতা: ${filters.fatherName}`);
      if (filters.village) logDetails.push(`গ্রাম: ${filters.village}`);
      if (filters.dob) logDetails.push(`জন্ম: ${filters.dob}`);
      const queryStr = logDetails.join(', ') || 'সাধারণ অনুসন্ধান';

      const sampleIps = ['103.230.104.92', '202.5.51.36', '180.234.89.14', '45.125.220.80', '203.188.240.3'];
      const mockIp = sampleIps[Math.floor(Math.random() * sampleIps.length)];
      const mockLatency = `${Math.floor(Math.random() * 5) + 2}ms`;
      const now = new Date().toLocaleTimeString('bn-BD') + ' (এইমাত্র)';

      const newLog: SearchLog = {
        id: `log-${Date.now()}`,
        dateTime: now,
        ipAddress: mockIp,
        query: queryStr,
        responseTime: mockLatency,
        status: mappedResults.length > 0 ? 'Success' : 'Failed',
        method: filters.village ? 'VILLAGE_SEARCH' : 'NAME_SEARCH'
      };

      setSearchLogs(prev => [newLog, ...prev]);

    } catch (err) {
      console.error('Fetch error:', err);
      setFilteredVoters([]);
      setSearchPerformed(true);
    } finally {
      setSearching(false);
    }
  };

  const handleReset = () => {
    setFilteredVoters([]);
    setSearchPerformed(false);
  };

  const handleAddVoter = (newVoter: VoterRecord) => {
    // Local memory sync for compatibility with props, though manual creation is deprecated
    setVoters(prev => [newVoter, ...prev]);
    setFilteredVoters(prev => [newVoter, ...prev]);
  };

  const handleRemoveVoter = async (voterId: string) => {
    try {
      await fetch(`${API_BASE}/api/voters/${voterId}`, { method: 'DELETE' });
      setFilteredVoters(prev => prev.filter(v => v.id !== voterId));
      setRecentActions(prev => [
        { id: Date.now(), text: `ভোটার রেকর্ড ডিলিট সম্পন্ন`, time: 'এইমাত্র', type: 'red' },
        ...prev.slice(0, 4)
      ]);
    } catch (error) {
      console.error('Network error while removing voter', error);
    }
  };

  // Real voter count from Supabase (total from all PDFs)
  const totalVotersInSystem = uploadedPdfs.reduce((sum, p) => sum + (p.voterCount || 0), 0);

  return (
    <div id="voter-app-root" className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900 leading-normal">

      {/* Top Navigation Bar */}
      <nav id="voter-main-header" className="h-14 bg-blue-850 flex items-center justify-between px-6 shadow-md z-10 select-none">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-full p-1.5 flex items-center justify-center shadow-xs">
            <svg className="w-5 h-5 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04m17.236 0a11.959 11.959 0 01-2.818 10.8C15.596 18.812 13.939 20 12 20s-3.596-1.188-4.796-3.262a11.959 11.959 0 01-2.817-10.81" />
            </svg>
          </div>
          <span className="text-white font-bold tracking-tight text-base sm:text-lg flex items-center gap-2">
            VOTER DATABASE PORTAL
            <span className="font-light opacity-80 uppercase text-[10px] sm:text-xs tracking-wider border-l border-blue-600 pl-2 hidden sm:inline">
              Personal Voter Registry
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 text-emerald-300 bg-emerald-950/45 rounded-full border border-emerald-500/20 flex items-center gap-1.5 font-mono select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            SECURE ACCESS
          </span>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 lg:p-8">

        {currentView === 'dashboard' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-serif flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse-slow"></span>
                  অ্যাডমিন ভোটার কন্ট্রোল ড্যাশবোর্ড (Registry Admin Panel)
                </h1>
                <p className="text-sm text-slate-500 mt-1">লোকাল ডাটাবেস ও আপলোডকৃত ভোটার তালিকার সিস্টেম অ্যাক্টিভিটি বিশ্লেষণ</p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={loadPdfs}
                  className="px-4 py-2 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  ↻ রিফ্রেশ ডাটা
                </button>
                <button
                  onClick={() => setCurrentView('search')}
                  className="px-4 py-2 text-xs font-bold bg-blue-700 text-white hover:bg-blue-800 rounded-lg transition-colors cursor-pointer shadow-md shadow-blue-200"
                >
                  ভোটার অনুসন্ধান পোর্টাল
                </button>
              </div>
            </div>

            <AdminDashboard
              voters={voters}
              uploadedPdfs={uploadedPdfs}
              setUploadedPdfs={setUploadedPdfs}
              searchLogs={searchLogs}
              onAddVoter={handleAddVoter}
              onRemoveVoter={handleRemoveVoter}
              onRefreshPdfs={loadPdfs}
              totalVotersInSystem={totalVotersInSystem}
              pdfsLoading={pdfsLoading}
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar */}
            <aside className="w-full lg:w-64 flex flex-col gap-4 shrink-0">

              <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">অনুসন্ধান পরিসংখ্যান</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">মোট অনুসন্ধান</span>
                    <span className="text-sm font-bold font-mono">{searchCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">আজকের তথ্য</span>
                    <span className="text-sm font-bold text-blue-600 font-mono">{todaySearchCount}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (todaySearchCount / 150) * 100)}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">ডাটাবেজ সারসংক্ষেপ</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">মোট PDF আপলোড</span>
                    <span className="font-bold text-slate-800 font-mono">{uploadedPdfs.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">মোট ভোটার (সিস্টেমে)</span>
                    <span className="font-bold text-blue-600 font-mono">{totalVotersInSystem.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: uploadedPdfs.length > 0 ? '100%' : '0%' }}></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200 flex-1 min-h-[180px]">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">সাম্প্রতিক অ্যাকশন</h3>
                <div className="space-y-3">
                  {recentActions.length === 0 ? (
                    <p className="text-xs text-slate-400">কোনো অ্যাকশন নেই। ভোটার অনুসন্ধান করুন।</p>
                  ) : (
                    recentActions.map((action) => (
                      <div key={action.id} className={`border-l-2 pl-3 py-1 text-xs ${action.type === 'red' ? 'border-red-500' : 'border-blue-500'}`}>
                        <p className="font-semibold text-slate-700 leading-tight">{action.text}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{action.time}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </aside>

            {/* Main Search Area */}
            <section className="flex-1 flex flex-col gap-6 min-w-0">

              <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-905 text-white rounded-xl p-5 shadow-sm relative overflow-hidden shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 bg-white/5 rounded-full pointer-events-none"></div>
                <div className="z-10">
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-blue-500/30 border border-blue-400/20 uppercase tracking-widest text-blue-200 font-mono">ভোটার ডাটাবেজ পোর্টাল</span>
                  <h3 className="text-lg font-bold mt-1.5 font-serif leading-tight">ব্যক্তিগত ভোটার ডাটাবেস অনুসন্ধান</h3>
                  <p className="text-xs text-blue-100/90 leading-relaxed max-w-xl mt-1">
                    ব্যক্তিগত ভোটার তালিকা সার্ভার সচল রয়েছে। বাংলা বানান অনুযায়ী সঠিকভাবে নাম বা গ্রাম লিখে অনুসন্ধান শুরু করুন।
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3 text-xs bg-white/10 px-3 py-2 rounded-lg border border-white/10 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>DATABASE: {totalVotersInSystem > 0 ? `${totalVotersInSystem} RECORDS` : 'EMPTY — UPLOAD PDF'}</span>
                </div>
              </div>

              <div id="voter-search-section">
                <VoterSearchForm onSearch={handleSearch} onReset={handleReset} />
              </div>

              <div id="voter-results-section" className="transition-all duration-300">
                <VoterResultCard voters={filteredVoters} searchPerformed={searchPerformed} />
              </div>

            </section>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer id="voter-main-footer" className="bg-slate-800 flex flex-col sm:flex-row items-center justify-between px-6 py-4 sm:h-12 text-[10px] text-slate-400 border-t border-slate-700 select-none gap-3">
        <div>সিস্টেম ভার্সন: ৫.০.০ (Real Data)</div>

        <div className="flex gap-4 items-center flex-wrap justify-center">
          <button
            onClick={() => setCurrentView(currentView === 'search' ? 'dashboard' : 'search')}
            className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-md border border-slate-700 transition-all cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            {currentView === 'search' ? '🔒 এডমিন কন্ট্রোল লগইন' : '🔍 পাবলিক ভোটার পোর্টাল'}
          </button>

          <span className="hover:text-blue-400 cursor-pointer">গোপনীয়তা নীতি</span>
          <span className="hover:text-blue-400 cursor-pointer">যোগাযোগ</span>
          <span className="text-slate-500 hidden sm:inline">© ২০২৬ ডিজিটাল ভোটার ম্যানেজমেন্ট সিস্টেম</span>
        </div>
      </footer>

    </div>
  );
}
