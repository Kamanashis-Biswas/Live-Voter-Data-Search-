import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoterRecord, UploadedPdf } from '../types';
import * as pdfjs from 'pdfjs-dist';
import { API_BASE } from '../config';
import { 
  CreditCard, Printer, CheckCircle, AlertTriangle, XOctagon,
  MapPin, ChevronRight, UserCheck, Download, Info, Eye, X,
  FileText, Check, ZoomIn, ZoomOut, ChevronLeft, ChevronRightIcon,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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


interface Props {
  voters: VoterRecord[];
  searchPerformed: boolean;
  uploadedPdfs?: UploadedPdf[];
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
  const [zoom, setZoom] = useState(typeof window !== 'undefined' && window.innerWidth < 640 ? 0.65 : 1.2);
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 15, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="bg-slate-900/95 backdrop-blur-xl w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-5xl shadow-2xl border-0 sm:border border-slate-800 overflow-hidden flex flex-col rounded-none sm:rounded-2xl text-slate-100"
      >
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between shrink-0">
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
            {/* Desktop-only Header Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-xs mr-2">
              <button onClick={()=>setZoom(z=>Math.max(0.4,z-0.15))} className="p-1 hover:text-blue-400 cursor-pointer"><ZoomOut className="w-4 h-4"/></button>
              <span className="font-mono px-1.5 w-12 text-center">{Math.round(zoom*100)}%</span>
              <button onClick={()=>setZoom(z=>Math.min(3.0,z+0.15))} className="p-1 hover:text-blue-400 cursor-pointer"><ZoomIn className="w-4 h-4"/></button>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"><X className="w-5 h-5"/></button>
          </div>
        </div>

        {/* Voter Details Bar */}
        <div className="bg-slate-950/60 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 sm:px-5 sm:py-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-2 text-[11px] sm:text-xs text-slate-300">
          <div><span className="text-teal-400 font-bold">নাম:</span> <span className="font-bold text-white">{voter.nameBn}</span></div>
          <div><span className="text-teal-400 font-bold">পিতা:</span> <span className="font-medium text-slate-200">{voter.fatherName}</span></div>
          <div><span className="text-teal-400 font-bold">মাতা:</span> <span className="font-medium text-slate-200">{voter.motherName}</span></div>
          <div><span className="text-teal-400 font-bold">ভোটার নং:</span> <span className="font-mono font-bold text-emerald-400">{voter.voterNo}</span></div>
        </div>

        {/* PDF Canvas Area Container */}
        <div className="relative flex-1 min-h-0 bg-slate-950 flex flex-col border-b border-slate-800">
          {/* Scrollable Canvas Box */}
          <div 
            className="flex-1 overflow-auto flex items-start justify-start sm:justify-center p-2 sm:p-4 touch-auto overscroll-contain custom-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {loading && (
              <div className="flex flex-col items-center justify-center m-auto text-slate-400 py-12">
                <Loader2 className="w-10 h-10 animate-spin mb-3 text-teal-400"/>
                <p className="text-sm font-semibold">PDF লোড হচ্ছে...</p>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center justify-center m-auto text-rose-500 text-center max-w-sm py-12 px-4">
                <XOctagon className="w-10 h-10 mb-3 text-rose-500"/>
                <p className="text-sm font-semibold">{error}</p>
                <p className="text-xs text-slate-400 mt-2">Backend server চালু আছে কিনা নিশ্চিত করুন।</p>
              </div>
            )}
            {!loading && !error && (
              <div className="relative shadow-[0_0_30px_rgba(0,0,0,0.6)] border border-slate-800 rounded-lg overflow-hidden m-auto">
                <canvas ref={canvasRef} className="block bg-white"/>
              </div>
            )}
          </div>

          {/* Floating Zoom Controls for Mobile & Desktop */}
          {!loading && !error && (
            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-lg z-10">
              <button 
                onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} 
                className="p-2 hover:bg-slate-800 text-white rounded-lg cursor-pointer transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4"/>
              </button>
              <span className="font-mono text-xs text-slate-200 px-1.5 min-w-[44px] text-center select-none font-semibold">
                {Math.round(zoom*100)}%
              </span>
              <button 
                onClick={() => setZoom(z => Math.min(3.0, z + 0.15))} 
                className="p-2 hover:bg-slate-800 text-white rounded-lg cursor-pointer transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4"/>
              </button>
            </div>
          )}
        </div>

        {/* Page Navigation Footer */}
        <div className="bg-slate-900 border-t border-slate-800 p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">

          {/* Pagination Controls */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <button
              onClick={()=>setCurrentPage(p=>Math.max(1,p-1))}
              disabled={currentPage<=1||loading}
              className="px-3 py-1.5 text-xs font-bold border border-slate-800 rounded-xl bg-slate-950/80 text-slate-300 hover:bg-slate-800 disabled:opacity-30 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5"/>
              <span>আগের <span className="hidden sm:inline">পৃষ্ঠা</span></span>
            </button>
            
            <span className="text-xs text-slate-300 font-mono font-semibold px-2.5 py-1 bg-slate-950/50 rounded-lg border border-slate-800">
              পৃষ্ঠা <strong>{currentPage}</strong> / {totalPages}
            </span>
            
            <button
              onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))}
              disabled={currentPage>=totalPages||loading}
              className="px-3 py-1.5 text-xs font-bold border border-slate-800 rounded-xl bg-slate-950/80 text-slate-300 hover:bg-slate-800 disabled:opacity-30 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>পরের <span className="hidden sm:inline">পৃষ্ঠা</span></span>
              <ChevronRightIcon className="w-3.5 h-3.5"/>
            </button>
          </div>

          {/* Action Buttons (Go to page and Close) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {voter.pdfPageNumber && (
              <button
                onClick={()=>setCurrentPage(voter.pdfPageNumber!)}
                className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10 hover:shadow-amber-500/25 transition-all"
              >
                <MapPin className="w-3.5 h-3.5"/>
                <span className="hidden sm:inline">ভোটারের পৃষ্ঠায় যান (পৃষ্ঠা {voter.pdfPageNumber})</span>
                <span className="sm:hidden">ভোটারের পৃষ্ঠা ({voter.pdfPageNumber})</span>
              </button>
            )}

            <button 
              onClick={onClose} 
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-500/10 hover:shadow-red-500/25 transition-all cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main VoterResultCard ─────────────────────────────────────────────────────

export const VoterResultCard: React.FC<Props> = ({ voters, searchPerformed, uploadedPdfs }) => {
  const [selectedVoter, setSelectedVoter] = useState<VoterRecord | null>(null);
  const [pdfViewVoter, setPdfViewVoter] = useState<VoterRecord | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  /**
   * Generates formatted visual badges detailing the active operational registry status.
   */
  const getStatusBadge = (status: VoterRecord['status']) => {
    switch (status) {
      case 'সক্রিয়': return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"><CheckCircle className="w-3 h-3"/>সক্রিয়</span>;
      case 'সংশোধনযোগ্য': return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30"><AlertTriangle className="w-3 h-3"/>সংশোধনযোগ্য</span>;
      case 'স্থগিত': return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30"><XOctagon className="w-3 h-3"/>স্থগিত</span>;
      default: return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"><CheckCircle className="w-3 h-3"/>সক্রিয়</span>;
    }
  };

  /**
   * Generates and downloads a high-resolution, NID-styled JPG card of the voter.
   */
  const handleDownloadJpg = async (voter: VoterRecord) => {
    setIsDownloading(voter.id);
    const pdf = uploadedPdfs?.find(p => p.id === voter.pdfUploadId);
    const union = voter.unionName || pdf?.unionName || '—';
    const ward = voter.wardNo || pdf?.wardNo || '—';
    const upazila = voter.upazila || pdf?.upazila || '—';
    const district = voter.district || pdf?.district || '—';
    const voterArea = voter.voterArea || pdf?.voterArea || '—';
    const genderType = pdf?.genderType ? `ভোটার তালিকা - (${pdf.genderType})` : '';
    const width = 1012;
    const height = 638;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsDownloading(null);
      return;
    }

    // Wait for Noto Sans Bengali font to be fully loaded in the browser
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading check skipped, using standard fonts.', e);
    }

    // 1. Background Gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#022c22'); // deep emerald
    grad.addColorStop(0.5, '#064e3b'); // dark green
    grad.addColorStop(1, '#0f766e'); // teal
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Overlapping Security Watermark Circles (Guilloche Effect)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 8; i++) {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, i * 75, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 1; i <= 6; i++) {
      ctx.beginPath();
      ctx.arc(width, 0, i * 130, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, height, i * 130, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Fine Card Border Outline (Gold/Amber)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, width - 30, height - 30);

    // 4. Draw Bangladesh Flag (Top-Left Accent)
    ctx.fillStyle = '#059669'; // Flag Green
    ctx.beginPath();
    // Helper function for roundRect compatibility
    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h - r);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      }
    };
    drawRoundRect(55, 45, 80, 50, 6);
    ctx.fill();

    ctx.fillStyle = '#dc2626'; // Flag Red
    ctx.beginPath();
    ctx.arc(95, 70, 16, 0, Math.PI * 2);
    ctx.fill();

    // 5. Draw Government Titles (Top Center)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Primary Title
    ctx.font = "bold 26px 'Noto Sans Bengali', 'Inter', sans-serif";
    ctx.fillStyle = '#ffffff';
    ctx.fillText('গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', width / 2 + 20, 55);

    // Subtitle (Changed to Voter Card as requested)
    ctx.font = "bold 18px 'Noto Sans Bengali', 'Inter', sans-serif";
    ctx.fillStyle = '#fbbf24'; // Golden Yellow
    ctx.fillText('ভোটার কার্ড / Voter Card', width / 2 + 20, 92);

    // Top Right Gender List Type Banner
    if (genderType) {
      ctx.textAlign = 'right';
      ctx.font = "bold 15px 'Noto Sans Bengali', 'Inter', sans-serif";
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText(genderType, width - 55, 55);
    }

    // 6. Draw Metallic Smart Chip
    const chipX = 55;
    const chipY = 160;
    const chipW = 110;
    const chipH = 78;
    const chipRad = 12;

    const chipGrad = ctx.createLinearGradient(chipX, chipY, chipX + chipW, chipY + chipH);
    chipGrad.addColorStop(0, '#fbbf24'); // Bright Gold
    chipGrad.addColorStop(0.5, '#f59e0b'); // Gold
    chipGrad.addColorStop(1, '#b45309'); // Dark Bronze
    ctx.fillStyle = chipGrad;
    ctx.beginPath();
    drawRoundRect(chipX, chipY, chipW, chipH, chipRad);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Chip contact divider lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 2.5;
    
    ctx.beginPath();
    ctx.moveTo(chipX + chipW * 0.33, chipY);
    ctx.lineTo(chipX + chipW * 0.33, chipY + chipH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(chipX + chipW * 0.67, chipY);
    ctx.lineTo(chipX + chipW * 0.67, chipY + chipH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(chipX, chipY + chipH * 0.5);
    ctx.lineTo(chipX + chipW, chipY + chipH * 0.5);
    ctx.stroke();

    // 7. Draw Voter Details (Two-column layout containing parents, location, area, and occupation)
    ctx.textAlign = 'left';
    const textX1 = 200;
    const textX2 = 590;
    let currentY = 170;

    // Row 1: Name (Full Width)
    ctx.fillStyle = '#a7f3d0'; // Light emerald/teal
    ctx.font = "500 15px 'Noto Sans Bengali', sans-serif";
    ctx.fillText('নাম / Name:', textX1, currentY);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 24px 'Noto Sans Bengali', sans-serif";
    ctx.fillText(voter.nameBn || '—', textX1 + 105, currentY);
    currentY += 46;

    // Helper for two-column details
    const drawColRow = (label1: string, val1: string, label2: string, val2: string) => {
      // Left Col
      ctx.fillStyle = '#a7f3d0';
      ctx.font = "500 14px 'Noto Sans Bengali', sans-serif";
      ctx.fillText(label1, textX1, currentY);
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 18px 'Noto Sans Bengali', sans-serif";
      ctx.fillText(val1 || '—', textX1 + 105, currentY);

      // Right Col
      ctx.fillStyle = '#a7f3d0';
      ctx.font = "500 14px 'Noto Sans Bengali', sans-serif";
      ctx.fillText(label2, textX2, currentY);
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 18px 'Noto Sans Bengali', sans-serif";
      ctx.fillText(val2 || '—', textX2 + 105, currentY);

      currentY += 38;
    };

    drawColRow('পিতা / Father:', voter.fatherName, 'মাতা / Mother:', voter.motherName);
    drawColRow('জন্ম তারিখ:', voter.dob, 'লিঙ্গ / Gender:', voter.gender);
    drawColRow('ইউনিয়ন:', union, 'ওয়ার্ড নম্বর:', ward);
    drawColRow('উপজেলা:', upazila, 'জেলা / Zilla:', district);
    
    // Voter Area (longer string, so we can draw it on the left and occupation on the right)
    ctx.fillStyle = '#a7f3d0';
    ctx.font = "500 14px 'Noto Sans Bengali', sans-serif";
    ctx.fillText('ভোটার এলাকা:', textX1, currentY);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 16px 'Noto Sans Bengali', sans-serif";
    const displayArea = voterArea && voterArea.length > 35 
      ? voterArea.slice(0, 35) + '...' 
      : voterArea || '—';
    ctx.fillText(displayArea, textX1 + 105, currentY);

    if (voter.occupation) {
      ctx.fillStyle = '#a7f3d0';
      ctx.font = "500 14px 'Noto Sans Bengali', sans-serif";
      ctx.fillText('পেশা:', textX2, currentY);
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 16px 'Noto Sans Bengali', sans-serif";
      ctx.fillText(voter.occupation, textX2 + 105, currentY);
    }
    currentY += 38;

    // 8. Draw Voter Number & Serial Number Info Box (Widened to fit card)
    const bannerX = 55;
    const bannerY = currentY - 5;
    const bannerW = 902;
    const bannerH = 92;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    drawRoundRect(bannerX, bannerY, bannerW, bannerH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Voter No
    ctx.fillStyle = '#fbbf24'; // Amber Gold
    ctx.font = "bold 15px 'Noto Sans Bengali', sans-serif";
    ctx.fillText('ভোটার নম্বর (Voter No)', bannerX + 25, bannerY + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 26px 'JetBrains Mono', 'Inter', monospace, sans-serif";
    ctx.fillText(voter.voterNo || '—', bannerX + 25, bannerY + 62);

    // Serial No
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8'; // Sky Blue
    ctx.font = "bold 15px 'Noto Sans Bengali', sans-serif";
    ctx.fillText('ক্রমিক নম্বর (Serial No)', bannerX + bannerW - 25, bannerY + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 26px 'JetBrains Mono', 'Inter', monospace, sans-serif";
    ctx.fillText(voter.serialNo || '—', bannerX + bannerW - 25, bannerY + 62);

    // 9. Draw Simulated Barcode (Footer Center-Left, Widened)
    ctx.textAlign = 'left';
    const barcodeX = 55;
    const barcodeY = bannerY + bannerH + 20;
    const barcodeW = 450;
    const barcodeH = 65;

    // Barcode container box (white)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    drawRoundRect(barcodeX, barcodeY, barcodeW, barcodeH, 4);
    ctx.fill();

    // Draw lines inside container
    ctx.fillStyle = '#000000';
    let lineX = barcodeX + 15;
    const endLineX = barcodeX + barcodeW - 15;
    while (lineX < endLineX) {
      const lineWidth = Math.floor(Math.random() * 4) + 1.5;
      const spacing = Math.floor(Math.random() * 3) + 2.5;
      if (lineX + lineWidth > endLineX) break;
      ctx.fillRect(lineX, barcodeY + 8, lineWidth, barcodeH - 28);
      lineX += lineWidth + spacing;
    }

    // Print Voter ID/Number below lines
    ctx.fillStyle = '#000000';
    ctx.font = "bold 11px 'JetBrains Mono', 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(voter.voterNo || '0000000000', barcodeX + barcodeW / 2, barcodeY + barcodeH - 7);

    // 10. Draw Official Verification Stamp (Footer Right)
    const sealX = width - 180;
    const sealY = barcodeY + 30;

    // Outer circular stamp
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sealX, sealY, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.beginPath();
    ctx.arc(sealX, sealY, 34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.font = "bold 9px 'Noto Sans Bengali', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('ভেরিফাইড', sealX, sealY - 6);
    ctx.fillText('নির্বাচন কমিশন', sealX, sealY + 6);

    // Blue ink signature
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(sealX - 45, sealY + 15);
    ctx.bezierCurveTo(sealX - 20, sealY - 45, sealX - 5, sealY - 20, sealX + 25, sealY - 45);
    ctx.bezierCurveTo(sealX + 35, sealY - 55, sealX + 5, sealY + 35, sealX + 40, sealY + 10);
    ctx.stroke();

    // Signature label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = "9px 'Noto Sans Bengali', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('কর্তৃপক্ষের স্বাক্ষর', sealX, sealY + 58);

    // 11. Convert canvas to JPEG and download
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.download = `Voter_Card_${voter.nameBn.replace(/\s+/g, '_')}_${voter.voterNo || voter.id.slice(0, 6)}.jpg`;
    link.href = dataUrl;
    link.click();
    setIsDownloading(null);
  };

  if (!searchPerformed) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-md bg-white/70 rounded-2xl border border-white/30 p-8 md:p-12 text-center max-w-2xl mx-auto shadow-2xl"
      >
        <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-6"><Info className="w-8 h-8"/></div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 font-serif">অনুসন্ধান শুরু করুন</h3>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">ভোটারের নাম, পিতার নাম, মাতার নাম, বা গ্রামের নাম দিয়ে অনুসন্ধান করুন।</p>
        <div className="flex justify-center gap-6 text-xs text-slate-400 font-mono">
          <span>● লাইভ ডাটাবেজ</span><span>● তাৎক্ষণিক ফলাফল</span>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search statistics header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md bg-slate-900/80 border border-white/10 text-white p-5 rounded-2xl shadow-xl"
      >
        <div>
          <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider font-mono">অনুসন্ধান ফলাফল</p>
          <h3 className="text-lg font-bold font-serif">{voters.length > 0 ? `${voters.length} জন ভোটার পাওয়া গেছে` : 'কোন ভোটার রেকর্ড পাওয়া যায়নি'}</h3>
        </div>
        <div className="text-xs bg-slate-800/80 border border-slate-700/80 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>লাইভ সার্ভার
        </div>
      </motion.div>

      {voters.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="backdrop-blur-md bg-white/70 rounded-2xl border border-white/30 p-12 text-center shadow-2xl"
        >
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><XOctagon className="w-8 h-8"/></div>
          <p className="text-slate-800 font-bold mb-1 font-serif text-lg">কোনো মিল পাওয়া যায়নি</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">নাম বা গ্রামের সঠিক বানান লিখুন এবং আবার চেষ্টা করুন।</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {voters.map((voter, index) => {
            const borderClass = voter.status === 'সক্রিয়' 
              ? 'border-emerald-500/20 hover:border-emerald-500/50 shadow-emerald-500/5 hover:shadow-emerald-500/15' 
              : voter.status === 'স্থগিত' 
              ? 'border-rose-500/20 hover:border-rose-500/50 shadow-rose-500/5 hover:shadow-rose-500/15' 
              : 'border-amber-500/20 hover:border-amber-500/50 shadow-amber-500/5 hover:shadow-amber-500/15';

            const statusBadge = getStatusBadge(voter.status);
            const pdf = uploadedPdfs?.find(p => p.id === voter.pdfUploadId);
            const union = voter.unionName || pdf?.unionName || '—';
            const ward = voter.wardNo || pdf?.wardNo || '—';
            const upazila = voter.upazila || pdf?.upazila || '—';
            const district = voter.district || pdf?.district || '—';
            const voterArea = voter.voterArea || pdf?.voterArea || '—';
            const genderType = pdf?.genderType ? `ভোটার তালিকা - (${pdf.genderType})` : '';

            return (
              <motion.div 
                key={voter.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
                className={`glass-card rounded-2xl border ${borderClass} hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col`}
              >
                {/* Card Top Title Bar */}
                <div className="bg-slate-900/90 text-white px-4 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400"/>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 leading-none">ভোটার বিবরণ</h4>
                      <span className="text-[9px] text-slate-400 font-mono">Voter Card</span>
                    </div>
                  </div>
                  {statusBadge}
                </div>

                {/* National Identity Visual Card Layout */}
                <div className="p-4.5 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white relative overflow-hidden shrink-0 select-none">
                  {/* Subtle Circular Watermarks */}
                  <div className="absolute right-[-15px] top-[-15px] w-28 h-28 bg-emerald-700/10 rounded-full border border-emerald-500/10 flex items-center justify-center text-emerald-500/5 text-5xl font-bold">BD</div>
                  <div className="absolute left-[-20px] bottom-[-20px] w-36 h-36 bg-teal-800/10 rounded-full border border-teal-500/5"></div>
                  
                  <div className="relative z-10 flex gap-4">
                    {/* Left Column: Smart Chip */}
                    <div className="flex flex-col gap-2.5 shrink-0 items-center justify-start pt-1.5">
                      {/* Metallic Gold Chip icon */}
                      <div className="w-12 h-9 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 rounded-md border border-amber-200/40 shadow-inner relative overflow-hidden flex flex-col justify-between p-1">
                        <div className="flex justify-between h-full w-full">
                          <div className="w-1/3 border-r border-amber-800/30 h-full"></div>
                          <div className="w-1/3 border-r border-amber-800/30 h-full"></div>
                        </div>
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-amber-800/30 -translate-y-1/2"></div>
                      </div>
                    </div>

                    {/* Right Column: Text Details */}
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <p className="text-emerald-300 text-[8px] font-semibold uppercase tracking-wider">
                        গণপ্রজাতন্ত্রী বাংলাদেশ সরকার • নির্বাচন কমিশন {genderType && `• ${genderType}`}
                      </p>
                      
                      <div className="space-y-0.5">
                        <p className="text-[8px] text-emerald-300/80 leading-none">নাম / Name</p>
                        <p className="font-bold text-base text-white leading-snug truncate" title={voter.nameBn}>{voter.nameBn}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-emerald-100/90 pt-1 border-t border-emerald-800/60">
                        <p className="truncate" title={voter.fatherName}><span className="text-emerald-300/80">পিতা:</span> {voter.fatherName || '—'}</p>
                        <p className="truncate" title={voter.motherName}><span className="text-emerald-300/80">মাতা:</span> {voter.motherName || '—'}</p>
                        <p className="truncate"><span className="text-emerald-300/80">জন্ম:</span> <span className="font-mono">{voter.dob || '—'}</span></p>
                        <p className="truncate"><span className="text-emerald-300/80">লিঙ্গ:</span> {voter.gender || '—'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-emerald-100/90 pt-1 border-t border-emerald-800/60">
                        <p className="truncate" title={union}><span className="text-emerald-300/80">ইউনিয়ন:</span> {union}</p>
                        <p className="truncate" title={ward}><span className="text-emerald-300/80">ওয়ার্ড:</span> {ward}</p>
                        <p className="truncate" title={upazila}><span className="text-emerald-300/80">উপজেলা:</span> {upazila}</p>
                        <p className="truncate" title={district}><span className="text-emerald-300/80">জেলা:</span> {district}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-1 text-[10px] text-emerald-100/90 pt-1 border-t border-emerald-800/60">
                        <p className="truncate" title={voterArea}><span className="text-emerald-300/80">ভোটার এলাকা:</span> {voterArea}</p>
                        {voter.occupation && (
                          <p className="truncate" title={voter.occupation}><span className="text-emerald-300/80">পেশা:</span> {voter.occupation}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Highlight Row: Voter ID & Serial Number */}
                  <div className="mt-3.5 pt-2 border-t border-emerald-800/80 flex justify-between items-center text-xs">
                    <div className="bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-800/40">
                      <span className="text-emerald-300/70 text-[8px] block leading-none">ভোটার নম্বর</span>
                      <span className="text-amber-400 font-bold font-mono text-[11px]">{voter.voterNo || '—'}</span>
                    </div>
                    <div className="bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-800/40 text-right">
                      <span className="text-emerald-300/70 text-[8px] block leading-none">ক্রমিক নম্বর</span>
                      <span className="text-sky-300 font-bold font-mono text-[11px]">{voter.serialNo || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions buttons footer (Address block removed, clean footer layout) */}
                <div className="p-4 bg-slate-950/40 border-t border-white/5 flex gap-2 shrink-0 mt-auto backdrop-blur-md">
                  {voter.pdfUploadId && (
                    <button
                      onClick={() => setPdfViewVoter(voter)}
                      className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all duration-200 text-xs"
                      title="PDF-এ ভেরিফাই করুন"
                    >
                      <Eye className="w-3.5 h-3.5"/>ভেরিফাই করুন
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadJpg(voter)}
                    disabled={isDownloading === voter.id}
                    className={`${voter.pdfUploadId ? 'flex-1' : 'w-full'} py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-teal-500/10 hover:shadow-teal-500/25 transition-all duration-200 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="ভোটার আইডি কার্ড ডাউনলোড করুন"
                  >
                    {isDownloading === voter.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                        ডাউনলোড হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5"/>
                        ডাউনলোড (JPG)
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Embedded PDF Canvas modal popup viewer */}
      <AnimatePresence>
        {pdfViewVoter && <PdfViewer voter={pdfViewVoter} onClose={() => setPdfViewVoter(null)}/>}
      </AnimatePresence>
    </div>
  );
};
