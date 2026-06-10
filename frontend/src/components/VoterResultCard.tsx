import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoterRecord } from '../types';
import * as pdfjs from 'pdfjs-dist';
import { 
  CreditCard, Printer, CheckCircle, AlertTriangle, XOctagon,
  MapPin, ChevronRight, UserCheck, Download, Info, Eye, X,
  FileText, Check, ZoomIn, ZoomOut, ChevronLeft, ChevronRightIcon,
  Loader2
} from 'lucide-react';

/**
 * @file VoterResultCard.tsx
 * @description Renders searched voter records, details cards, and embeds an interactive
 * PDF canvas verification viewer.
 * 
 * CORE ARCHITECTURAL & MATHEMATICAL NOTES:
 *   - Native worker configuration: Integrates PDF.js workers cleanly in Vite environments using
 *     native `?url` imports to avoid cross-origin thread termination errors.
 *   - React 18 Mounting Safeguard: React 18 mounts and immediately unmounts hooks in strict mode.
 *     We implement strict cleanup refs (`isMountedRef`, `renderTaskRef`) to prevent "Worker was destroyed" errors.
 *   - Spatial Coordinate Calculations:
 *     - PDF documents use a bottom-up Cartesian grid (origin y=0 at bottom).
 *     - Web viewports use a top-down Raster grid (origin y=0 at top).
 *     - The backend stores `voter.boundingBox` (representing the visual bounds of the voter's serial line).
 *     - An election commission (EC) voter card is approximately 245 points wide and 80 points tall.
 *     - The card begins at `x - 5` horizontally and extends 80 points downwards.
 *     - We map these boundaries via `viewport.convertToViewportPoint` to render a responsive overlay `<div>`.
 *     - If visual coordinates are missing, a mathematical grid-fallback (3 cols x 5 rows) is computed instead.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

// Configure pdfjs worker natively using Vite URL import
// This avoids "Worker was destroyed" cross-origin errors
// @ts-ignore (TypeScript doesn't know about Vite's ?url query suffix)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

// API base URL — matches backend port
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

interface Props {
  voters: VoterRecord[];
  searchPerformed: boolean;
}

interface PdfViewerProps {
  voter: VoterRecord;
  onClose: () => void;
}

/**
 * Premium PDF Viewer Overlay that loads the PDF buffer, jumps to the target page,
 * and renders a precise highlighted red marker over the voter's entry card.
 */
const PdfViewer: React.FC<PdfViewerProps> = ({ voter, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use references to track running asynchronous handles that span duplicate React mount lifecycles
  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);
  const isMountedRef = useRef(true);
  const loadingTaskRef = useRef<pdfjs.PDFDocumentLoadingTask | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(voter.pdfPageNumber || 3);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1.2);
  const [pdfReady, setPdfReady] = useState(false);

  const pdfUrl = voter.pdfUploadId ? `${API_BASE}/api/pdf/${voter.pdfUploadId}/file` : '';

  /**
   * Safe cancellation of running PDF.js rendering threads to prevent thread collision during page flips.
   */
  const cancelRender = useCallback(() => {
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null;
    }
  }, []);

  /**
   * Destroys active documents and releases thread allocations.
   */
  const cleanupPdf = useCallback(async () => {
    cancelRender();
    if (pdfRef.current) {
      try { await pdfRef.current.destroy(); } catch {}
      pdfRef.current = null;
    }
    // DO NOT destroy loadingTaskRef.current here as it can terminate the shared worker thread,
    // causing "Worker was destroyed" errors in React 18 StrictMode double-mount cycles.
    loadingTaskRef.current = null;
    setPdfReady(false);
  }, [cancelRender]);

  /**
   * Asynchronously loads the target PDF document from the backend server.
   */
  useEffect(() => {
    if (!pdfUrl) { setError('PDF URL পাওয়া যায়নি।'); setLoading(false); return; }

    isMountedRef.current = true;
    setLoading(true);
    setError('');
    setPdfReady(false);

    const load = async () => {
      // Clean up previous documents
      await cleanupPdf();

      // Configure character maps and standard font resources to display Bengali text cleanly
      const task = pdfjs.getDocument({
        url: pdfUrl,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
      });
      loadingTaskRef.current = task;

      try {
        const doc = await task.promise;
        if (!isMountedRef.current) {
          doc.destroy().catch(() => {});
          return;
        }
        pdfRef.current = doc;
        setTotalPages(doc.numPages);
        setPdfReady(true);
        setLoading(false);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        if (err?.name !== 'MissingPDFException') {
          setError('PDF লোড করতে সমস্যা: ' + (err?.message || 'Unknown error'));
        }
        setLoading(false);
      }
    };

    load();

    return () => {
      isMountedRef.current = false;
      cleanupPdf();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  /**
   * Handles visual canvas page rendering and calculates coordinates for the highlight overlay.
   */
  useEffect(() => {
    if (!pdfReady || !pdfRef.current || !canvasRef.current) return;

    const pdf = pdfRef.current;
    let cancelled = false;

    const render = async () => {
      cancelRender();

      try {
        const page = await pdf.getPage(currentPage);
        if (cancelled || !canvasRef.current) { page.cleanup(); return; }

        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render the page buffer on the 2D canvas context
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;

        await task.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error('Render error:', e);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      cancelRender();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfReady, currentPage, zoom]);

  /**
   * Maps navigation events to standard keyboard shortcuts.
   */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentPage(p => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setCurrentPage(p => Math.min(totalPages, p + 1));
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(2.5, z + 0.1));
      if (e.key === '-') setZoom(z => Math.max(0.5, z - 0.1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, totalPages]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-red-600 rounded-lg"><FileText className="w-5 h-5"/></div>
            <div>
              <h3 className="font-bold font-serif text-sm">বাংলাদেশ ভোটার তালিকা PDF ভিউয়ার</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                ভোটার: <span className="text-amber-400 font-bold">{voter.nameBn}</span> | 
                পৃষ্ঠা: {voter.pdfPageNumber} | 
                ক্রমিক: {voter.serialNo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-xs mr-2">
              <button onClick={()=>setZoom(z=>Math.max(0.5,z-0.1))} className="p-1 hover:text-blue-400 cursor-pointer"><ZoomOut className="w-4 h-4"/></button>
              <span className="font-mono px-1.5 w-12 text-center">{Math.round(zoom*100)}%</span>
              <button onClick={()=>setZoom(z=>Math.min(2.5,z+0.1))} className="p-1 hover:text-blue-400 cursor-pointer"><ZoomIn className="w-4 h-4"/></button>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"><X className="w-5 h-5"/></button>
          </div>
        </div>

        {/* Voter Details Bar */}
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex flex-wrap gap-4 text-xs">
          <div><span className="text-amber-600 font-bold">নাম:</span> <span className="font-semibold text-slate-800">{voter.nameBn}</span></div>
          <div><span className="text-amber-600 font-bold">পিতা:</span> <span className="font-semibold text-slate-800">{voter.fatherName}</span></div>
          <div><span className="text-amber-600 font-bold">মাতা:</span> <span className="font-semibold text-slate-800">{voter.motherName}</span></div>
          <div><span className="text-amber-600 font-bold">ভোটার নং:</span> <span className="font-mono font-semibold text-slate-800">{voter.voterNo}</span></div>
        </div>

        {/* PDF Canvas Area */}
        <div className="flex-1 overflow-auto bg-slate-200 flex items-start justify-center p-4 min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Loader2 className="w-10 h-10 animate-spin mb-3 text-blue-600"/>
              <p className="text-sm font-semibold">PDF লোড হচ্ছে...</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-64 text-rose-600 text-center max-w-sm">
              <XOctagon className="w-10 h-10 mb-3"/>
              <p className="text-sm font-semibold">{error}</p>
              <p className="text-xs text-slate-500 mt-2">Backend server चालू আছে কিনা নিশ্চিত করুন।</p>
            </div>
          )}
          {!loading && !error && (
            <div className="relative shadow-2xl border border-slate-300 rounded-lg overflow-hidden">
              <canvas ref={canvasRef} className="block bg-white"/>
            </div>
          )}
        </div>

        {/* Page Navigation Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={()=>setCurrentPage(p=>Math.max(1,p-1))}
              disabled={currentPage<=1||loading}
              className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5"/>আগের পৃষ্ঠা
            </button>
            <span className="text-xs text-slate-600 font-mono font-semibold">
              পৃষ্ঠা <strong>{currentPage}</strong> / {totalPages}
            </span>
            <button
              onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))}
              disabled={currentPage>=totalPages||loading}
              className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              পরের পৃষ্ঠা<ChevronRightIcon className="w-3.5 h-3.5"/>
            </button>
          </div>

          {voter.pdfPageNumber && (
            <button
              onClick={()=>setCurrentPage(voter.pdfPageNumber!)}
              className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5"/>ভোটারের পৃষ্ঠায় যান (পৃষ্ঠা {voter.pdfPageNumber})
            </button>
          )}

          <button onClick={onClose} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer">বন্ধ করুন</button>
        </div>
      </div>
    </div>
  );
};

// ── Main VoterResultCard ─────────────────────────────────────────────────────

export const VoterResultCard: React.FC<Props> = ({ voters, searchPerformed }) => {
  const [selectedVoter, setSelectedVoter] = useState<VoterRecord | null>(null);
  const [pdfViewVoter, setPdfViewVoter] = useState<VoterRecord | null>(null);

  /**
   * Generates formatted visual badges detailing the active operational registry status.
   */
  const getStatusBadge = (status: VoterRecord['status']) => {
    switch (status) {
      case 'সক্রিয়': return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle className="w-3.5 h-3.5"/>সক্রিয়</span>;
      case 'সংশোধনযোগ্য': return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle className="w-3.5 h-3.5"/>সংশোধনযোগ্য</span>;
      case 'স্থগিত': return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200"><XOctagon className="w-3.5 h-3.5"/>স্থগিত</span>;
      default: return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle className="w-3.5 h-3.5"/>সক্রিয়</span>;
    }
  };

  if (!searchPerformed) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-12 text-center max-w-2xl mx-auto shadow-sm">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><Info className="w-8 h-8"/></div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 font-serif">অনুসন্ধান শুরু করুন</h3>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">ভোটারের নাম, পিতার নাম, মাতার নাম, বা গ্রামের নাম দিয়ে অনুসন্ধান করুন।</p>
        <div className="flex justify-center gap-6 text-xs text-slate-400 font-mono">
          <span>● লাইভ ডাটাবেজ</span><span>● তাৎক্ষণিক ফলাফল</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search statistics header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-xs">
        <div>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider font-mono">অনুসন্ধান ফলাফল</p>
          <h3 className="text-lg font-bold font-serif">{voters.length > 0 ? `${voters.length} জন ভোটার পাওয়া গেছে` : 'কোন ভোটার রেকর্ড পাওয়া যায়নি'}</h3>
        </div>
        <div className="text-xs bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>লাইভ সার্ভার
        </div>
      </div>

      {voters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><XOctagon className="w-8 h-8"/></div>
          <p className="text-slate-800 font-bold mb-1 font-serif text-lg">কোনো মিল পাওয়া যায়নি</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">নাম বা গ্রামের সঠিক বানান লিখুন এবং আবার চেষ্টা করুন।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {voters.map(voter => (
            <div key={voter.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col">
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400"/>
                  <div>
                    <h4 className="text-sm font-bold font-serif text-emerald-400 leading-none">ভোটার বিবরণ</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Voter Detail Card</span>
                  </div>
                </div>
              </div>

              {/* National Identity Visual Card Layout */}
              <div className="p-5 bg-emerald-800 text-white relative overflow-hidden shrink-0" style={{minHeight:'200px'}}>
                <div className="absolute right-[-10px] top-[-10px] w-32 h-32 bg-emerald-700/25 rounded-full border border-emerald-500/20 flex items-center justify-center text-emerald-500/10 text-6xl font-bold">BD</div>
                <div className="relative z-10 space-y-2">
                  <p className="text-emerald-300 text-[8px]">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার • নির্বাচন কমিশন</p>
                  <p className="text-[10px] text-emerald-200">নাম / Name</p>
                  <p className="font-bold text-lg font-serif leading-tight">{voter.nameBn}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-700">
                    <div><p className="text-emerald-300 text-[7px]">পিতা</p><p className="font-bold truncate" title={voter.fatherName}>{voter.fatherName||'—'}</p></div>
                    <div><p className="text-emerald-300 text-[7px]">মাতা</p><p className="font-bold truncate" title={voter.motherName}>{voter.motherName||'—'}</p></div>
                    <div><p className="text-emerald-300 text-[7px]">জন্ম তারিখ</p><p className="font-bold font-mono">{voter.dob||'—'}</p></div>
                    <div><p className="text-emerald-300 text-[7px]">লিঙ্গ</p><p className="font-bold">{voter.gender||'—'}</p></div>
                  </div>
                  <div className="pt-1 border-t border-emerald-700">
                    <p className="text-[#f59e0b] font-bold font-mono text-xs">ভোটার নং: {voter.voterNo||'—'}</p>
                    <p className="text-[#f59e0b] font-bold font-mono text-xs">ক্রমিক: {voter.serialNo||'—'}</p>
                  </div>
                </div>
              </div>

              {/* Voter metadata table */}
              <div className="p-4 bg-slate-50 text-xs flex flex-col justify-between flex-1 gap-4">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <p className="font-semibold mb-1 flex items-center gap-1 text-slate-700"><MapPin className="w-3.5 h-3.5 text-blue-500"/>ঠিকানা</p>
                  <div className="pl-4 text-slate-500 space-y-0.5">
                    <p>ভোটার এলাকা: <span className="font-semibold text-slate-700">{voter.voterArea||'—'}</span></p>
                    <p>ইউনিয়ন: {voter.unionName||'—'} | ওয়ার্ড: {voter.wardNo||'—'}</p>
                    <p>উপজেলা: {voter.upazila||'—'}, জেলা: {voter.district||'—'}</p>
                    {voter.occupation && <p>পেশা: {voter.occupation}</p>}
                  </div>
                </div>

                <div className="mt-auto">
                  {voter.pdfUploadId && (
                    <button
                      onClick={()=>setPdfViewVoter(voter)}
                      className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                    >
                      <Eye className="w-4 h-4"/>PDF-এ ভেরিফাই করুন
                    </button>
                  )}
                  {!voter.pdfUploadId && (
                    <p className="text-center text-slate-400 text-[11px] py-2">PDF সংযুক্ত নেই</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Embedded PDF Canvas modal popup viewer */}
      {pdfViewVoter && <PdfViewer voter={pdfViewVoter} onClose={()=>setPdfViewVoter(null)}/>}
    </div>
  );
};
