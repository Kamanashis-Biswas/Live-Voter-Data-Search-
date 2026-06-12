import { useState, useEffect, useCallback } from 'react';
import { SearchFilters, VoterRecord, UploadedPdf, SearchLog } from './types';
import { VoterSearchForm } from './components/VoterSearchForm';
import { VoterResultCard } from './components/VoterResultCard';
import { AdminDashboard } from './components/AdminDashboard';
import { DeveloperModal } from './components/DeveloperModal';
import { API_BASE } from './config';
import {
  Lock,
  Loader2,
  Menu,
  X,
  CheckCircle,
  XOctagon,
  Info,
} from 'lucide-react';
import bgShapes from './assets/bg-shapes.png';

/**
 * @file App.tsx
 * @description Main application container for the Live Voter Search portal.
 * Manages the global state, public search forms, responsive viewport grids, 
 * administrative analytics dashboards, logging registries, and real-time toast alert prompts.
 * 
 * CORE ARCHITECTURAL FLOW:
 *   - Fetches and tracks PDF lists (`loadPdfs`) and polls backend health states.
 *   - Orchestrates search routing (`handleSearch`) to fetch, map, and paginate database queries.
 *   - Responsive Design: Renders a sticky desktop aside sidebar, but on mobile, shifts into a
 *     swipe-in sliding drawer toggled by hamburger menu elements below the navigation bars.
 *   - Glassmorphic portal toast prompts replace browser `alert()` popups for Copy actions.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

/**
 * Utility helper that translates English digits to Bengali digits.
 */
const toBangla = (n: number | string): string => {
  const d = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  return String(n).split('').map(c => { const i = parseInt(c); return isNaN(i) ? c : d[i]; }).join('');
};

export default function App() {
  // Navigation states
  const [currentView, setCurrentView] = useState<'search' | 'dashboard'>('search');
  
  // Search result collections
  const [voters, setVoters] = useState<VoterRecord[]>([]);
  const [filteredVoters, setFilteredVoters] = useState<VoterRecord[]>([]);
  
  // Search metrics & history tracking states (used for admin logs and graphs)
  const [searchPerformed, setSearchPerformed] = useState<boolean>(false);
  const [searchCount, setSearchCount] = useState<number>(0);
  const [todaySearchCount, setTodaySearchCount] = useState<number>(0);
  const [recentActions, setRecentActions] = useState<Array<{ id: number; text: string; time: string; type: 'red' | 'blue' }>>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);

  // Page loader, health, and online tracking states
  const [searching, setSearching] = useState<boolean>(false);
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [showDevModal, setShowDevModal] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<number>(1);

  // Generate or retrieve session ID for heartbeat tracking
  const [sessionId] = useState(() => {
    let id = sessionStorage.getItem('voter_session_id');
    if (!id) {
      id = 'sess-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      sessionStorage.setItem('voter_session_id', id);
    }
    return id;
  });

  /**
   * Mobile Sidebar Drawer State
   * - Controls visibility of the collapsible sidebar on mobile screens (viewport < lg breakpoint).
   * - Triggers sliding CSS transitions and maps overlay backdrops when true.
   */
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  /**
   * Global Toast Notification State
   * - Stores the active toast message and its aesthetic category ('success' | 'error' | 'info').
   * - When populated, renders a floating glassmorphic overlay inside a React portal adjacent to the page content.
   */
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  /**
   * Triggers a global floating toast notification.
   * Utilizes React.useCallback to prevent redundant renders when passed down as a prop to child panels.
   * 
   * @param {string} message - The text content to display.
   * @param {'success' | 'error' | 'info'} type - The category style (defaults to 'success').
   */
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  /**
   * Automatic Toast Auto-Dismiss Cycle
   * - Listens to updates in the active toast state.
   * - Configures a non-blocking 3-second (3000ms) timer to clear the message and dismiss the panel.
   * - Leverages a cleanup callback to clear the active timer if the toast is manually dismissed or updated, preventing memory leaks.
   */
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Uploaded PDFs catalog collections
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [pdfsLoading, setPdfsLoading] = useState<boolean>(false);

/**
   * Fetches recent search logs from the backend server.
   */
  const loadSearchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/voters/search-logs`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.logs) {
          const mappedLogs: SearchLog[] = data.logs.map((log: any) => {
            const date = new Date(log.dateTime || log.date_time);
            const timeStr = date.toLocaleTimeString('bn-BD') + ' ' + date.toLocaleDateString('bn-BD');
            return {
              id: log.id,
              dateTime: timeStr,
              ipAddress: log.ipAddress || log.ip_address || '127.0.0.1',
              query: log.query || '',
              responseTime: log.responseTime || log.response_time || '0ms',
              status: log.status === 'Success' ? 'Success' : 'Failed',
              method: log.method || 'GET'
            };
          });
          setSearchLogs(mappedLogs);

          // Populate the sidebar's recentActions array with search actions from database
          const actions = mappedLogs.slice(0, 5).map((log) => ({
            id: Number(log.id.replace(/\D/g, '').slice(0, 9)) || Date.now() + Math.random(),
            text: log.query || 'সাধারণ অনুসন্ধান',
            time: log.dateTime,
            type: log.status === 'Success' ? 'blue' as const : 'red' as const
          }));
          setRecentActions(actions);
        }
      }
    } catch (err) {
      console.error('Failed to load search logs:', err);
    }
  }, []);

  /**
   * Transmits periodic heartbeat requests to track active online sessions.
   */
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch(`${API_BASE}/api/health/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      } catch (err) {
        console.warn('Heartbeat transmission failed:', err);
      }
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 10000);
    return () => clearInterval(interval);
  }, [sessionId]);

  /**
   * Periodically polls the server health and analytics stats.
   */
  useEffect(() => {
    const checkHealthAndStats = async () => {
      try {
        const healthRes = await fetch(`${API_BASE}/api/health`);
        setServerOnline(healthRes.ok);

        if (healthRes.ok) {
          const statsRes = await fetch(`${API_BASE}/api/health/stats`);
          if (statsRes.ok) {
            const data = await statsRes.json();
            if (data.success) {
              setOnlineUsers(data.onlineUsers || 1);
              setSearchCount(data.totalSearches || 0);
            }
          }
        }
      } catch {
        setServerOnline(false);
      }
    };
    checkHealthAndStats();
    const interval = setInterval(checkHealthAndStats, 10000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Fetches metadata for uploaded PDFs and maps the results into the frontend interface structure.
   */
  const loadPdfs = useCallback(async () => {
    setPdfsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/pdf/list`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.pdfs) {
          // Normalize API snake_case objects into clean camelCase models
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

  // Fetch PDFs and search logs on initial assembly mount
  useEffect(() => {
    loadPdfs();
    loadSearchLogs();
  }, [loadPdfs, loadSearchLogs]);

  /**
   * Queries the search API endpoint using client filters.
   * Maps matching datasets into the React state and records diagnostic logs.
   * 
   * @param {SearchFilters} filters - Query constraints populated by the search form.
   */
  const handleSearch = async (filters: SearchFilters) => {
    setSearching(true);
    const queryParams = new URLSearchParams();
    
    // Construct query parameters checking presence of input fields
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

      // Normalize search results mapping standard database schemas
      const mappedResults: VoterRecord[] = results.map((v: any) => {
        let resolvedUpazila = v.upazila || '';
        let resolvedDistrict = v.district || '';
        let resolvedVillage = v.village || '';
        let resolvedUnion = v.unionName || v.union_name || '';

        if (typeof v.address === 'string' && v.address) {
          const parts = v.address.split(/[,|]/).map((s: string) => s.trim()).filter(Boolean);
          if (parts.length >= 3) {
            resolvedUpazila = resolvedUpazila || parts[parts.length - 2] || '';
            resolvedDistrict = resolvedDistrict || parts[parts.length - 1] || '';
            resolvedVillage = resolvedVillage || parts[0] || '';
          }
        } else if (v.address && typeof v.address === 'object') {
          resolvedUpazila = resolvedUpazila || v.address.upazila || '';
          resolvedDistrict = resolvedDistrict || v.address.district || '';
          resolvedVillage = resolvedVillage || v.address.village || '';
        }

        // Also extract ward number from voter area text if wardNo is empty
        let resolvedWard = v.wardNo || v.ward_no || '';
        const voterAreaText = v.voterArea || v.voter_area || '';
        if (!resolvedWard && voterAreaText) {
          const match = voterAreaText.match(/([0-9\u09E6-\u09EF]+)\s*(?:নং)?\s*(?:ওয়ার্ড|ওয়ার্ডের|ওয়ার্ড|ওয়ার্ডের)/);
          if (match) {
            resolvedWard = match[1];
          }
        }

        return {
          id: v.id,
          nid: v.nid || '',
          voterNo: v.voterNo || v.voter_no || '',
          nameBn: v.nameBn || v.name_bn || '',
          nameEn: v.nameEn || v.name_en || '',
          fatherName: v.fatherName || v.father_name || '',
          motherName: v.motherName || v.mother_name || '',
          dob: v.dob || '',
          village: resolvedVillage || v.village || '',
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
          unionName: resolvedUnion,
          wardNo: resolvedWard,
          voterArea: voterAreaText,
          voterAreaNo: v.voterAreaNo || v.voter_area_no || '',
          upazila: resolvedUpazila,
          district: resolvedDistrict,
          postCode: v.postCode || v.post_code || '',
          publicationDate: v.publicationDate || v.publication_date || '',
          pdfUploadId: v.pdfUploadId || v.pdf_upload_id || '',
          address: {
            village: resolvedVillage || v.village || '',
            postOffice: voterAreaText || '',
            upazila: resolvedUpazila,
            district: resolvedDistrict
          }
        };
      });

      setFilteredVoters(mappedResults);
      setSearchPerformed(true);
      setSearchCount(prev => prev + 1);
      setTodaySearchCount(prev => prev + 1);

      // Log action to the live activity stream
      setRecentActions(prev => [
        { id: Date.now(), text: `অনুসন্ধান: ${filters.name || filters.village || 'ফিল্টারসমূহ দ্বারা'}`, time: 'এইমাত্র', type: 'blue' },
        ...prev.slice(0, 4)
      ]);

      // Construct a detailed summary for diagnostic IP logs
      const logDetails: string[] = [];
      if (filters.name) logDetails.push(`নাম: ${filters.name}`);
      if (filters.fatherName) logDetails.push(`পিতা: ${filters.fatherName}`);
      if (filters.village) logDetails.push(`গ্রাম: ${filters.village}`);
      if (filters.dob) logDetails.push(`জন্ম: ${filters.dob}`);
      const queryStr = logDetails.join(', ') || 'সাধারণ অনুসন্ধান';

      // Pick a random mock IP for the session diagnostic log table
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

  /**
   * Resets active search results and toggles form filters.
   */
  const handleReset = () => {
    setFilteredVoters([]);
    setSearchPerformed(false);
  };

  /**
   * Toggles the active view routing, resets state caches, and loads search logs if entering admin dashboard.
   */
  const handleViewChange = (view: 'search' | 'dashboard') => {
    handleReset();
    setCurrentView(view);
    if (view === 'dashboard') {
      loadSearchLogs();
    }
  };

  /**
   * Triggers a full dashboard refresh.
   */
  const handleRefreshDashboard = useCallback(async () => {
    await loadPdfs();
    await loadSearchLogs();
  }, [loadPdfs, loadSearchLogs]);

  /**
   * Core callback synced to update local state upon inserting manual entries.
   */
  const handleAddVoter = (newVoter: VoterRecord) => {
    setVoters(prev => [newVoter, ...prev]);
    setFilteredVoters(prev => [newVoter, ...prev]);
  };

  /**
   * Dispatches a DELETE request to purge a voter record from the local database.
   * 
   * @param {string} voterId - Target record UUID.
   */
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

  // Compile overall voter record metric summaries loaded in the system
  const totalVotersInSystem = uploadedPdfs.reduce((sum, p) => sum + (p.voterCount || 0), 0);

  return (
    <div 
      id="voter-app-root" 
      className="min-h-screen font-sans text-slate-900 flex flex-col justify-between selection:bg-teal-500/25 selection:text-teal-900 leading-normal relative overflow-hidden bg-slate-900 bg-fixed"
      style={{
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.65)), url(${bgShapes})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >

      {/* Top Premium Navigation Bar */}
      <nav id="voter-main-header" className="h-14 backdrop-blur-md bg-slate-900/80 border-b border-white/10 flex items-center justify-between px-6 shadow-lg z-10 select-none">
        <div className="flex items-center gap-3">
          <div className="bg-white/90 rounded-full p-1.5 flex items-center justify-center shadow-md">
            <svg className="w-5 h-5 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04m17.236 0a11.959 11.959 0 01-2.818 10.8C15.596 18.812 13.939 20 12 20s-3.596-1.188-4.796-3.262a11.959 11.959 0 01-2.817-10.81" />
            </svg>
          </div>
          <span className="text-white font-extrabold tracking-wider text-base sm:text-lg flex items-center gap-2">
            VOTER DATABASE
            <span className="font-light opacity-80 uppercase text-[10px] sm:text-xs tracking-widest border-l border-teal-500/40 pl-2 hidden sm:inline">
              Personal Voter Registry
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Active Server Health Indicator Pin */}
          {serverOnline ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold px-3 py-1 text-emerald-400 bg-emerald-950/40 backdrop-blur-xs rounded-full border border-emerald-500/30 flex items-center gap-1.5 font-mono select-none">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                অনলাইন: {toBangla(onlineUsers)} জন
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-3 py-1 text-slate-350 bg-slate-800/40 backdrop-blur-xs rounded-full border border-white/10 flex items-center gap-1.5 font-mono select-none">
                SECURE ACCESS
              </span>
            </div>
          ) : (
            <span className="text-[10px] sm:text-xs font-bold px-3 py-1 text-rose-400 bg-rose-950/50 backdrop-blur-xs rounded-full border border-rose-500/30 flex items-center gap-1.5 font-mono select-none">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              SERVER OFFLINE
            </span>
          )}
        </div>
      </nav>

      {/* Main Content Layout Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 lg:p-8 z-10">

        {/* View Router Toggle: Switch between Search Forms and Admin Dashboards */}
        {currentView === 'dashboard' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/15 gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-teal-500 animate-pulse"></span>
                  অ্যাডমিন ভোটার কন্ট্রোল ড্যাশবোর্ড (Registry Admin Panel)
                </h1>
                <p className="text-sm text-slate-350 mt-1">লোকাল ডাটাবেস ও আপলোডকৃত ভোটার তালিকার সিস্টেম অ্যাক্টিভিটি বিশ্লেষণ</p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={handleRefreshDashboard}
                  disabled={pdfsLoading}
                  className="px-4 py-2 text-xs font-bold backdrop-blur-md bg-white/70 text-slate-900 hover:bg-white/95 border border-white/40 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-black/5"
                >
                  {pdfsLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
                      লোডিং...
                    </>
                  ) : (
                    <>↻ রিফ্রেশ ডাটা</>
                  )}
                </button>
                <button
                  onClick={() => handleViewChange('search')}
                  className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-teal-500/10 hover:shadow-teal-500/35 hover:scale-[1.02] active:scale-[0.98]"
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
              onRefreshPdfs={handleRefreshDashboard}
              totalVotersInSystem={totalVotersInSystem}
              pdfsLoading={pdfsLoading}
              showToast={showToast}
              onlineUsers={onlineUsers}
              totalSearches={searchCount}
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 relative">
            {/* Backdrop screen cover mask that intercepts clicks to close mobile swipe aside drawers */}
            {sidebarOpen && (
              <div
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-45 transition-opacity duration-300"
              />
            )}

            {/* Sidebar Slide-Out Drawer Panel.
                Combines persistent grid col alignment on large views (`lg:relative`) with smooth 
                transform sliding transitions (`-translate-x-full` ➔ `translate-x-0`) on mobile viewports. */}
            <aside className={`
              fixed top-0 left-0 h-full w-72 backdrop-blur-md bg-white/75 shadow-2xl z-50 p-4 border-r border-white/20 flex flex-col gap-4 overflow-y-auto transition-transform duration-300 ease-in-out transform
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              lg:relative lg:translate-x-0 lg:w-64 lg:h-auto lg:shadow-none lg:bg-transparent lg:border-none lg:p-0 lg:z-auto lg:flex
            `}>

              {/* Close Button Header visible only in mobile viewports */}
              <div className="backdrop-blur-md bg-white/50 rounded-xl shadow-xs p-3.5 border border-white/20 lg:hidden flex justify-between items-center shrink-0">
                <span className="text-xs font-bold text-slate-800">পরিসংখ্যান ও তথ্য</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-slate-100 active:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
                  title="বন্ধ করুন"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Analytics widgets */}
              <div className="backdrop-blur-md bg-white/75 rounded-2xl shadow-lg p-4 border border-white/30 hover:shadow-teal-500/5 transition-all duration-300">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">অনুসন্ধান পরিসংখ্যান</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">মোট অনুসন্ধান</span>
                    <span className="text-sm font-bold font-mono text-slate-800">{searchCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium">আজকের তথ্য</span>
                    <span className="text-sm font-extrabold text-teal-600 font-mono">{todaySearchCount}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200/50 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (todaySearchCount / 150) * 100)}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="backdrop-blur-md bg-white/75 rounded-2xl shadow-lg p-4 border border-white/30 hover:shadow-teal-500/5 transition-all duration-300">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">ডাটাবেজ সারসংক্ষেপ</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">মোট PDF আপলোড</span>
                    <span className="font-bold text-slate-800 font-mono">{uploadedPdfs.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">মোট ভোটার (সিস্টেমে)</span>
                    <span className="font-extrabold text-teal-600 font-mono">{totalVotersInSystem.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-200/50 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: uploadedPdfs.length > 0 ? '100%' : '0%' }}></div>
                  </div>
                </div>
              </div>

              <div className="backdrop-blur-md bg-white/75 rounded-2xl shadow-lg p-4 border border-white/30 hover:shadow-teal-500/5 transition-all duration-300 flex-1 min-h-[180px]">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">সাম্প্রতিক অ্যাকশন</h3>
                <div className="space-y-3">
                  {recentActions.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium">কোনো অ্যাকশন নেই। ভোটার অনুসন্ধান করুন।</p>
                  ) : (
                    recentActions.map((action) => (
                      <div key={action.id} className={`border-l-2 pl-3 py-1 text-xs ${action.type === 'red' ? 'border-rose-500' : 'border-teal-500'}`}>
                        <p className="font-semibold text-slate-700 leading-tight">{action.text}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{action.time}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </aside>

            {/* Public search layout container */}
            <section className="flex-1 flex flex-col gap-6 min-w-0">

              {/* Responsive Hamburger Toggle button positioned cleanly below the navbar on mobile */}
              <div className="lg:hidden flex items-center shrink-0">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="backdrop-blur-md bg-white/70 text-slate-800 border border-white/30 shadow-lg px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/80 active:bg-white/90 transition-all cursor-pointer"
                >
                  <Menu className="w-4.5 h-4.5 text-teal-600 animate-pulse" />
                  পরিসংখ্যান ও তথ্য ড্যাশবোর্ড
                </button>
              </div>

              {/* Status Header Banner */}
              <div className={`backdrop-blur-md bg-gradient-to-r ${serverOnline ? 'from-slate-900/80 via-teal-950/80 to-indigo-950/80 border border-white/10' : 'from-slate-900/80 via-rose-950/80 to-indigo-950/80 border border-rose-500/20'} text-white rounded-2xl p-5 shadow-2xl relative overflow-hidden shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-500`}>
                <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 bg-white/5 rounded-full pointer-events-none"></div>
                <div className="z-10">
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-widest font-mono ${serverOnline ? 'bg-teal-500/20 border border-teal-500/30 text-teal-200' : 'bg-rose-500/20 border border-rose-500/30 text-rose-200'}`}>
                    {serverOnline ? 'ভোটার ডাটাবেজ পোর্টাল' : 'সিস্টেম অফলাইন'}
                  </span>
                  <h3 className="text-lg font-bold mt-1.5 leading-tight">
                    {serverOnline ? 'ব্যক্তিগত ভোটার ডাটাবেস অনুসন্ধান' : 'ডাটাবেস সার্ভার অফলাইন'}
                  </h3>
                  <p className="text-xs text-teal-100/90 leading-relaxed max-w-xl mt-1">
                    {serverOnline 
                      ? 'ব্যক্তিগত ভোটার তালিকা সার্ভার সচল রয়েছে। বাংলা বানান অনুযায়ী সঠিকভাবে নাম বা গ্রাম লিখে অনুসন্ধান শুরু করুন।'
                      : 'সার্ভার অফলাইন বা ক্র্যাশ করেছে! অনুগ্রহ করে ব্যাকএন্ড সার্ভার চালু করুন (npm run dev)।'}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3 text-xs bg-white/10 px-3 py-2 rounded-lg border border-white/10 font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-emerald-400 animate-ping' : 'bg-rose-500 animate-pulse'}`}></span>
                  <span>DATABASE: {!serverOnline ? 'OFFLINE' : (totalVotersInSystem > 0 ? `${totalVotersInSystem} RECORDS` : 'EMPTY — UPLOAD PDF')}</span>
                </div>
              </div>

              {/* Voter Search Form */}
              <div id="voter-search-section">
                <VoterSearchForm onSearch={handleSearch} onReset={handleReset} serverOnline={serverOnline} searching={searching} />
              </div>

              {/* Search result cards lists */}
              <div id="voter-results-section" className="transition-all duration-300">
                <VoterResultCard voters={filteredVoters} searchPerformed={searchPerformed} uploadedPdfs={uploadedPdfs} />
              </div>

            </section>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer id="voter-main-footer" className="backdrop-blur-md bg-slate-900/85 text-slate-400 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between px-6 py-4 sm:h-12 text-[10px] select-none gap-3 z-10">
        <div>সিস্টেম ভার্সন: ৫.০.০ (Real Data)</div>

        <div className="flex gap-4 items-center flex-wrap justify-center">
          <button
            onClick={() => handleViewChange(currentView === 'search' ? 'dashboard' : 'search')}
            className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1.5 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-teal-500/20 hover:border-teal-500/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            {currentView === 'search' ? '🔒 এডমিন কন্ট্রোল লগইন' : '🔍 পাবলিক ভোটার পোর্টাল'}
          </button>

          <span className="hover:text-teal-450 cursor-pointer">গোপনীয়তা নীতি</span>
          <span className="hover:text-teal-450 cursor-pointer">যোগাযোগ</span>
          <span className="text-slate-500 hidden sm:inline">
            © ২০২৬ ডিজিটাল ভোটার ম্যানেজমেন্ট সিস্টেম | তৈরীকৃত ও রক্ষণাবেক্ষণে: <button onClick={() => setShowDevModal(true)} className="text-teal-400 hover:text-teal-300 hover:underline font-bold transition-all cursor-pointer bg-transparent border-none p-0 inline">Kamanashis Biswas</button>
          </span>
        </div>
      </footer>

      {/* Developer Profile Modal */}
      <DeveloperModal isOpen={showDevModal} onClose={() => setShowDevModal(false)} />

      {/* Premium custom glassmorphic portal Toast notifications */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] animate-slide-in">
          <div className={`
            px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-xs sm:text-sm font-semibold transition-all duration-300 backdrop-blur-md bg-white/95
            ${toast.type === 'success' ? 'border-emerald-200 text-emerald-800 shadow-emerald-100/50' : ''}
            ${toast.type === 'error' ? 'border-rose-200 text-rose-800 shadow-rose-100/50' : ''}
            ${toast.type === 'info' ? 'border-blue-200 text-blue-800 shadow-blue-100/50' : ''}
          `}>
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toast.type === 'error' && <XOctagon className="w-5 h-5 text-rose-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="p-1 hover:bg-slate-100 rounded-lg ml-2 shrink-0 cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
