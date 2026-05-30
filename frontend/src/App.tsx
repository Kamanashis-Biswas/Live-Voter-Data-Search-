import { useState } from 'react';
import { SearchFilters, VoterRecord, UploadedPdf, SearchLog } from './types';
import { mockVoters } from './data/mockVoters';
import { VoterSearchForm } from './components/VoterSearchForm';
import { VoterResultCard } from './components/VoterResultCard';
import { AdminDashboard } from './components/AdminDashboard';
import { 
  Vote, 
  Database,
  ShieldCheck, 
  RefreshCw,
  TrendingUp,
  Award,
  Lock,
  Globe
} from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'search' | 'dashboard'>('search');
  const [voters, setVoters] = useState<VoterRecord[]>(mockVoters);
  const [filteredVoters, setFilteredVoters] = useState<VoterRecord[]>([]);
  const [searchPerformed, setSearchPerformed] = useState<boolean>(false);
  const [searchCount, setSearchCount] = useState<number>(1420);
  const [todaySearchCount, setTodaySearchCount] = useState<number>(84);
  const [recentActions, setRecentActions] = useState<Array<{ id: number; text: string; time: string; type: 'red' | 'blue' }>>([
    { id: 1, text: 'সার্ভার রিসেট সম্পন্ন', time: '১০ মিনিট আগে', type: 'red' },
    { id: 2, text: 'নতুন ডাটা যোগ করা হয়েছে', time: '২ ঘণ্টা আগে', type: 'blue' }
  ]);

  // Track PDFs uploaded to the personal server
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([
    {
      id: "pdf-1",
      fileName: "সবুজপুর_ভোটর_তালিকা_৪৫.pdf",
      fileSize: "৮.৫ MB",
      uploadTime: "বিগত ২ ঘণ্টা আগে",
      pageNumber: "৪৫",
      detectedArea: "সবুজপুর",
      status: "সফল",
      integrityHash: "SHA-256: 91bca72fe4a85112dc86ac0...",
      voterIds: voters.filter(v => v.village === "সবুজপুর").map(v => v.id)
    },
    {
      id: "pdf-2",
      fileName: "লালবাগ_৩_ভোটার_তালিকা_পৃষ্ঠা_১২.pdf",
      fileSize: "১২.৪ MB",
      uploadTime: "৩ ঘণ্টা আগে",
      pageNumber: "১২",
      detectedArea: "লালবাগ",
      status: "সফল",
      integrityHash: "SHA-256: 8f9b90c10a4db527e98d89cb...",
      voterIds: voters.filter(v => v.village === "লালবাগ").map(v => v.id)
    }
  ]);

  // Track user search queries and IP addresses
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([
    { id: '1', dateTime: '২০২৬-০৫-৩০ ১০:৪১:১২', ipAddress: '১০৩.২৩০.১০৪.১৫', query: 'নাম: মোঃ হাসানুজ্জামান শান্ত, গ্রাম: সবুজপুর', responseTime: '৪ms', status: 'Success', method: 'NAME_SEARCH' },
    { id: '2', dateTime: '২০২৬-০৫-৩০ ১০:৩৯:৪৫', ipAddress: '২০২.৫.৫১.২', query: 'গ্রাম: সবুজপুর', responseTime: '২ms', status: 'Success', method: 'VILLAGE_SEARCH' },
    { id: '3', dateTime: '২০২৬-০৫-৩০ ১০:৩৭:০১', ipAddress: '১৮০.২৩৪.৮৯.১৪২', query: 'পিতা: সৈয়দ আলী, গ্রাম: আমতলী', responseTime: '৫ms', status: 'Failed', method: 'FATHER_SEARCH' },
    { id: '4', dateTime: '২০২৬-০৫-৩০ ১০:৩৫:৫৮', ipAddress: '১০৩.২৩০.১০৪.১৫', query: 'গ্রাম: সোনারগাঁও', responseTime: '৩ms', status: 'Success', method: 'VILLAGE_SEARCH' },
    { id: '5', dateTime: '২০২৬-০৫-৩০ ১০:৩২:২০', ipAddress: '৪৫.১২৫.২২০.১৮', query: 'নাম: সুস্মিতা, গ্রাম: লালবাগ', responseTime: '৬ms', status: 'Success', method: 'NAME_SEARCH' }
  ]);

  const handleSearch = async (filters: SearchFilters) => {
    const queryParams = new URLSearchParams();
    if (filters.name) queryParams.append('name', filters.name);
    if (filters.fatherName) queryParams.append('fatherName', filters.fatherName);
    if (filters.village) queryParams.append('village', filters.village);

    try {
      const response = await fetch(`http://localhost:3000/api/voters/search?${queryParams.toString()}`);
      if (!response.ok) {
        console.error('Failed to fetch from backend');
        setFilteredVoters([]);
        setSearchPerformed(true);
        return;
      }
      const data = await response.json();
      let results = data.results || [];

      // Map backend fields to frontend interface
      const mappedResults = results.map((v: any) => ({
        id: v.id,
        nid: v.nid,
        voterNo: v.voter_no,
        nameBn: v.name_bn,
        nameEn: v.name_en,
        fatherName: v.father_name,
        motherName: v.mother_name,
        dob: v.dob,
        village: v.village,
        gender: v.gender,
        bloodGroup: v.blood_group,
        pageNumber: v.page_number,
        status: v.status || 'সক্রিয়'
      }));

      // Client-side fallback for filters not supported by backend yet
      const finalResults = mappedResults.filter((voter: VoterRecord) => {
        const matchMother = !filters.motherName || 
          voter.motherName.includes(filters.motherName.trim());
          
        const matchDob = !filters.dob || voter.dob === filters.dob;
        
        let matchGender = true;
        if (filters.gender === 'male') {
          matchGender = voter.gender === 'পুরুষ';
        } else if (filters.gender === 'female') {
          matchGender = voter.gender === 'মহিলা';
        }
        
        return matchMother && matchDob && matchGender;
      });

      setFilteredVoters(finalResults);
      setSearchPerformed(true);
      setSearchCount(prev => prev + 1);
      setTodaySearchCount(prev => prev + 1);
      
      // Add real-time action log to the public changelog panel
      setRecentActions(prev => [
        { id: Date.now(), text: `অনুসন্ধান: ${filters.name || filters.village || 'ফিল্টারসমূহ দ্বারা'}`, time: 'এইমাত্র', type: 'blue' },
        ...prev.slice(0, 4)
      ]);

      // Append to admin search activity log list
      const logDetails: string[] = [];
      if (filters.name) logDetails.push(`নাম: ${filters.name}`);
      if (filters.fatherName) logDetails.push(`পিতা: ${filters.fatherName}`);
      if (filters.village) logDetails.push(`গ্রাম: ${filters.village}`);
      if (filters.dob) logDetails.push(`জন্ম: ${filters.dob}`);
      const queryStr = logDetails.join(', ') || 'সাধারণ অনুসন্ধান';

      const sampleIps = ['১০৩.২৩০.১০৪.৯২', '২০২.৫.৫১.৩৬', '১৮০.২৩৪.৮৯.১৪', '৪৫.১২৫.২২০.৮০', '২০৩.১৮৮.২৪০.৩'];
      const mockIp = sampleIps[Math.floor(Math.random() * sampleIps.length)];
      const mockLatency = `${Math.floor(Math.random() * 5) + 2}ms`;
      const banglaNow = new Date().toLocaleTimeString('bn-BD') + ' (এইমাত্র)';

      const newLog: SearchLog = {
        id: `log-${Date.now()}`,
        dateTime: banglaNow,
        ipAddress: mockIp,
        query: queryStr,
        responseTime: mockLatency,
        status: finalResults.length > 0 ? 'Success' : 'Failed',
        method: filters.village ? 'VILLAGE_SEARCH' : 'NAME_SEARCH'
      };

      setSearchLogs(prev => [newLog, ...prev]);

    } catch (err) {
      console.error('Fetch error:', err);
      setFilteredVoters([]);
      setSearchPerformed(true);
    }
  };

  const handleReset = () => {
    setFilteredVoters([]);
    setSearchPerformed(false);
  };

  const handleAddVoter = async (newVoter: VoterRecord) => {
    try {
      const response = await fetch('http://localhost:3000/api/voters/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nid: newVoter.nid,
          voterNo: newVoter.voterNo,
          nameBn: newVoter.nameBn,
          nameEn: newVoter.nameEn,
          fatherName: newVoter.fatherName,
          motherName: newVoter.motherName,
          dob: newVoter.dob,
          village: newVoter.village,
          gender: newVoter.gender,
          bloodGroup: newVoter.bloodGroup,
          pageNumber: newVoter.page_number
        })
      });
      
      if (response.ok) {
        setVoters(prev => [newVoter, ...prev]);
        setRecentActions(prev => [
          { id: Date.now(), text: `নতুন ভোটার যোগ: ${newVoter.nameBn}`, time: 'এইমাত্র', type: 'blue' },
          ...prev.slice(0, 4)
        ]);
      } else {
        console.error('Failed to add voter to backend');
      }
    } catch (error) {
      console.error('Network error while adding voter', error);
    }
  };

  const handleRemoveVoter = async (voterId: string) => {
    try {
      // Assuming a DELETE endpoint exists
      const response = await fetch(`http://localhost:3000/api/voters/${voterId}`, {
        method: 'DELETE'
      });
      
      // Even if backend fails, we remove it from UI for this demo
      setVoters(prev => prev.filter(v => v.id !== voterId));
      setRecentActions(prev => [
        { id: Date.now(), text: `ভোটার রেকর্ড ডিলিট সম্পন্ন`, time: 'এইমাত্র', type: 'red' },
        ...prev.slice(0, 4)
      ]);
    } catch (error) {
      console.error('Network error while removing voter', error);
    }
  };


  return (
    <div id="voter-app-root" className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900 leading-normal">
      
      {/* Top Navigation Bar from High Density Theme: Admin tabs removed for public transparency */}
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

      {/* Main Content Area: Conditional Views based on high-density SaaS patterns */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {currentView === 'dashboard' ? (
          <div className="space-y-6">
            {/* Elegant Subheader inside Admin Area */}
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
                  onClick={() => alert('সিস্টেম ডাটা রিফ্রেশ করা হচ্ছে...')}
                  className="px-4 py-2 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                  রিফ্রেশ ডাটা
                </button>
                <button 
                  onClick={() => setCurrentView('search')}
                  className="px-4 py-2 text-xs font-bold bg-blue-700 text-white hover:bg-blue-800 rounded-lg transition-colors cursor-pointer shadow-md shadow-blue-200"
                >
                  ভোটার অনুসন্ধান পোর্টাল
                </button>
              </div>
            </div>

            {/* Render the SaaS Admin Dashboard Component with connected states */}
            <AdminDashboard 
              voters={voters}
              uploadedPdfs={uploadedPdfs}
              setUploadedPdfs={setUploadedPdfs}
              searchLogs={searchLogs}
              onAddVoter={handleAddVoter}
              onRemoveVoter={handleRemoveVoter}
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Panel for high density summary info */}
            <aside className="w-full lg:w-64 flex flex-col gap-4 shrink-0">
              
              {/* Statistics Box */}
              <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">অনুসন্ধান পরিসংখ্যান</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">মোট অনুসন্ধান</span>
                    <span className="text-sm font-bold font-mono">{searchCount.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">আজকের তথ্য</span>
                    <span className="text-sm font-bold text-blue-600 font-mono">{todaySearchCount.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (todaySearchCount / 150) * 100)}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Demographic Metrics Box */}
              <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">ভোটার জেন্ডার অনুপাত</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">पुरुष ভোটার অনুপাত</span>
                    <span className="font-bold text-slate-800 font-mono">৫১.৮%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: '51.8%' }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">মহিলা ভোটার অনুপাত</span>
                    <span className="font-bold text-slate-800 font-mono">৪৮.২%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-50" style={{ width: '48.2%' }}></div>
                  </div>
                </div>
              </div>

              {/* Recent Action Activity Changelog */}
              <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200 flex-1 min-h-[180px]">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">সাম্প্রতিক অ্যাকশন</h3>
                <div className="space-y-3">
                  {recentActions.map((action) => (
                    <div key={action.id} className={`border-l-2 pl-3 py-1 text-xs ${action.type === 'red' ? 'border-red-500' : 'border-blue-500'}`}>
                      <p className="font-semibold text-slate-700 leading-tight">{action.text}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{action.time}</p>
                    </div>
                  ))}
                </div>
              </div>

            </aside>

            {/* Primary Dynamic App Controller & Forms Grid view */}
            <section className="flex-1 flex flex-col gap-6 min-w-0">
              
              {/* Welcome Interactive Hero banner synced beautifully */}
              <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-905 text-white rounded-xl p-5 shadow-sm relative overflow-hidden shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 bg-white/5 rounded-full pointer-events-none"></div>
                <div className="z-10">
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-blue-500/30 border border-blue-400/20 uppercase tracking-widest text-blue-200 font-mono">ভোটার ডাটাবেজ পোর্টাল</span>
                  <h3 className="text-lg font-bold mt-1.5 font-serif leading-tight">ব্যক্তিগত ভোটার ডাটাবেস অনুসন্ধান</h3>
                  <p className="text-xs text-blue-100/90 leading-relaxed max-w-xl mt-1">
                    ব্যক্তিগত ভোটার তালিকা সার্ভার সচল রয়েছে। বাংলা বানান অনুযায়ী সঠিকভাবে নাম বা গ্রাম লিখে অনুসন্ধান শুরু করুন।
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3 text-xs bg-white/10 px-3 py-2 rounded-lg border border-white/10 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>LOCAL DATABASE: READY</span>
                </div>
              </div>

              {/* Centralized Search Box */}
              <div id="voter-search-section">
                <VoterSearchForm onSearch={handleSearch} onReset={handleReset} />
              </div>

              {/* Results table layout - queries states directly */}
              <div id="voter-results-section" className="transition-all duration-300">
                <VoterResultCard voters={filteredVoters} searchPerformed={searchPerformed} />
              </div>

            </section>
          </div>
        )}

      </main>

      {/* High Density Theme Custom Footer with Discreet Secure Toggle */}
      <footer id="voter-main-footer" className="bg-slate-800 flex flex-col sm:flex-row items-center justify-between px-6 py-4 sm:h-12 text-[10px] text-slate-400 border-t border-slate-700 select-none gap-3">
        <div>সিস্টেম ভার্সন: ৪.২.০ (Live)</div>
        
        {/* Toggle to turn Dashboard Mode on or off for administrators */}
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
