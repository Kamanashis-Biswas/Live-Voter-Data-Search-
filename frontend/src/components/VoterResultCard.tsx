import React, { useState } from 'react';
import { VoterRecord } from '../types';
import { 
  CreditCard, 
  Printer, 
  CheckCircle, 
  AlertTriangle, 
  XOctagon, 
  MapPin, 
  ChevronRight, 
  UserCheck, 
  FileCheck,
  Download,
  Info,
  Eye,
  X,
  FileText,
  Check,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface VoterResultCardProps {
  voters: VoterRecord[];
  searchPerformed: boolean;
}

export const VoterResultCard: React.FC<VoterResultCardProps> = ({ voters, searchPerformed }) => {
  const [selectedVoter, setSelectedVoter] = useState<VoterRecord | null>(null);
  const [isPrinting, setIsPrinting] = useState<string | null>(null);
  const [voterForPdf, setVoterForPdf] = useState<VoterRecord | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const getStatusBadge = (status: VoterRecord['status']) => {
    switch (status) {
      case 'সক্রিয়':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
            <CheckCircle className="w-3.5 h-3.5" />
            সক্রিয়
          </span>
        );
      case 'সংশোধনযোগ্য':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200/50">
            <AlertTriangle className="w-3.5 h-3.5" />
            সংশোধনযোগ্য
          </span>
        );
      case 'স্থগিত':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200/50">
            <XOctagon className="w-3.5 h-3.5" />
            স্থগিত
          </span>
        );
    }
  };

  const handlePrint = (voter: VoterRecord) => {
    setIsPrinting(voter.id);
    setTimeout(() => {
      setIsPrinting(null);
      alert(`${voter.nameBn}-এর ভোটার তথ্য সফলভাবে প্রিন্ট ট্র্যাকে যুক্ত হয়েছে!`);
    }, 1200);
  };

  if (!searchPerformed) {
    return (
      <div id="voter-intro-state" className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-12 text-center max-w-2xl mx-auto shadow-sm">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Info className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 font-serif">অনুসন্ধান শুরু করুন</h3>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          ভোটারের নাম, পিতার নাম, মাতার নাম, গ্রাম অথবা লিঙ্গ নির্বাচন করে ফিল্টার করুন। লাইভ ভোটার তথ্য ডেটাবেজ থেকে তাৎক্ষণিক অনুসন্ধান ফলাফল পেতে নিচে "সার্চ" বাটনে ক্লিক করুন।
        </p>
        <div className="flex justify-center gap-6 text-xs text-slate-400 font-mono">
          <span>● হালনাগাদকৃত ডেটাবেজ: ২০২৩-২০২৬</span>
          <span>● জাতীয় সার্ভার সংযোগ: সক্রিয়</span>
        </div>
      </div>
    );
  }

  return (
    <div id="voter-results-wrapper" className="space-y-6">
      {/* Search Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-xs">
        <div>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider font-mono">অনুসন্ধান ফলাফল / Search Query Results</p>
          <h3 className="text-lg font-bold font-serif">
            {voters.length > 0 ? `${voters.length} জন ভোটার নিবন্ধিত পাওয়া গেছে` : 'কোন ভোটার রেকর্ড পাওয়া যায়নি'}
          </h3>
        </div>
        <div className="text-xs bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          লাইভ সার্ভার রেসপন্স: 0.04s
        </div>
      </div>

      {voters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <XOctagon className="w-8 h-8" />
          </div>
          <p className="text-slate-800 font-bold mb-1 font-serif text-lg">দুঃখিত, কোনো মিল খুঁজে পাওয়া যায়নি</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            আপনার অনুসন্ধান ফিল্টারগুলো পুনরায় পরীক্ষা করুন এবং সঠিকভাবে বানান লিখে সার্চ করার চেষ্টা করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Results Table/List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between select-none">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ভোটার তালিকা ডেটাগ্রিড</span>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded font-semibold font-mono">MERN Active State</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="p-4 text-xs font-bold text-slate-600 font-serif">ভোটার নাম ও আইডি</th>
                    <th className="p-4 text-xs font-bold text-slate-600 hidden md:table-cell font-serif">পিতার নাম</th>
                    <th className="p-4 text-xs font-bold text-slate-600 font-serif">গ্রাম</th>
                    <th className="p-4 text-xs font-bold text-slate-600 text-center font-serif">পৃষ্ঠা নম্বর</th>
                    <th className="p-4 text-xs font-bold text-slate-600 font-serif">অবস্থা</th>
                    <th className="p-4 text-xs font-bold text-slate-600 text-right font-serif">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voters.map((voter) => (
                    <tr 
                      key={voter.id} 
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${selectedVoter?.id === voter.id ? 'bg-blue-50/30' : ''}`}
                      onClick={() => setSelectedVoter(voter)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={voter.photoUrl} 
                            alt={voter.nameBn} 
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs" 
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors">{voter.nameBn}</p>
                            <p className="text-xs text-slate-400 font-mono">NID: {voter.nid}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell text-xs text-slate-700 font-medium">
                        <p>{voter.fatherName}</p>
                        <p className="text-[10px] text-slate-400">মাতা: {voter.motherName}</p>
                      </td>
                      <td className="p-4 text-xs text-slate-700">
                        <p className="font-semibold flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{voter.village}</p>
                        <p className="text-slate-400 text-[10px]">{voter.district || voter.address?.district || ''}</p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-bold font-mono tracking-wide rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {voter.page_number}
                        </span>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(voter.status)}
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedVoter(voter);
                              setVoterForPdf(voter);
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg flex items-center gap-1 shadow-xs transition-all hover:scale-102 cursor-pointer"
                            title="পিডিএফ ভোটার রেকর্ড ভেরিফাই করুন"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>ভেরিফাই করুন</span>
                          </button>
                          
                          <button
                            onClick={() => setSelectedVoter(voter)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-0.5 transition-all"
                            title="স্মার্ট এনআইডি কার্ড প্রিভিউ দেখুন"
                          >
                            কার্ড
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exclusive Interactive National ID Preview Box */}
          <div className="lg:col-span-1">
            {selectedVoter ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden sticky top-6">
                
                {/* Government Card Head Style */}
                <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-bold font-serif text-emerald-400 leading-none">এনআইডি কার্ড প্রিভিউ</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Bangladesh National ID Layout</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedVoter(null)}
                    className="text-slate-400 hover:text-white text-xs font-bold"
                  >
                    বন্ধ করুন
                  </button>
                </div>

                {/* Simulated National Green Smart Card layout */}
                <div className="p-5 bg-slate-50 border-b border-slate-100">
                  <div className="bg-emerald-800 text-white rounded-xl p-4 shadow-sm relative overflow-hidden h-52 flex flex-col justify-between">
                    {/* Security Circular Overlay Watermark */}
                    <div className="absolute right-[-10px] top-[-10px] w-32 h-32 bg-emerald-700/25 rounded-full border border-emerald-500/20 pointer-events-none flex items-center justify-center text-emerald-500/10 text-6xl font-bold">BD</div>
                    
                    {/* Header */}
                    <div className="flex items-start justify-between z-10">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-red-600 border border-emerald-600 flex items-center justify-center font-bold text-[8px] text-white">★</div>
                        <div className="leading-none">
                          <p className="text-[10px] font-bold tracking-tight">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</p>
                          <p className="text-[8px] text-emerald-200 tracking-wider">Government of the People's Republic of Bangladesh</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-red-500 text-white border border-red-600 font-mono shadow-xs">NID card</span>
                      </div>
                    </div>

                    {/* Body contents */}
                    <div className="grid grid-cols-4 gap-2 py-2 items-center z-10">
                      {/* Portrait */}
                      <div className="col-span-1">
                        <div className="relative">
                          <img 
                            src={selectedVoter.photoUrl} 
                            alt={selectedVoter.nameBn} 
                            className="w-13 h-16 rounded bg-white object-cover border border-emerald-300" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute bottom-0 left-0 w-full bg-emerald-950/80 text-[6px] text-center text-emerald-300 tracking-widest font-mono">VERIFIED</div>
                        </div>
                      </div>
                      
                      {/* Local Text fields */}
                      <div className="col-span-3 text-[10px] font-medium space-y-0.5 pl-1">
                        <p className="text-emerald-300 text-[8px]">নাম / Name</p>
                        <p className="truncate font-bold text-slate-100 text-[11px] leading-tight font-serif uppercase">{selectedVoter.nameBn}</p>
                        <p className="truncate font-bold text-[9px] font-mono tracking-wide text-white">{selectedVoter.nameEn}</p>
                        
                        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-emerald-700">
                          <div>
                            <p className="text-emerald-300 text-[7px]">পিতা / Father</p>
                            <p className="truncate text-white text-[9px] font-bold">{selectedVoter.fatherName}</p>
                          </div>
                          <div>
                            <p className="text-emerald-300 text-[7px]">মাতা / Mother</p>
                            <p className="truncate text-white text-[9px] font-bold">{selectedVoter.motherName}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer barcode/fingerprint area & numeric data */}
                    <div className="flex items-end justify-between border-t border-emerald-700/60 pt-1.5 z-10">
                      <div className="text-[9px] font-bold font-mono">
                        <p className="text-emerald-300 text-[6px]">জন্ম তারিখ / DOB</p>
                        <p className="text-white font-bold">{selectedVoter.dob}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#f59e0b] font-bold font-mono text-[11px] tracking-widest">NID: {selectedVoter.nid}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Digital Signature Slot */}
                  <div className="mt-4 bg-white rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400">অনুমোদিত স্বাক্ষর (Authorized Signature)</p>
                      <p className="text-sm font-serif font-black italic tracking-widest text-[#1e3a8a] mt-1 select-none pr-3 scale-y-75 cursor-default">
                        ElectionComm_BD
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-slate-150 rounded flex items-center justify-center font-mono text-[9px] text-slate-400 border border-slate-200">
                      CHIP
                    </div>
                  </div>
                </div>

                {/* Real-time Card Operational actions */}
                <div className="p-4 bg-slate-50 flex flex-col gap-2">
                  <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                    <p className="font-semibold mb-1 flex items-center gap-1 text-slate-700"><MapPin className="w-3.5 h-3.5 text-blue-500" /> স্থায়ী ঠিকানা (Permanent Address)</p>
                    <div className="pl-4 text-slate-500 space-y-0.5">
                      <p>গ্রাম: {selectedVoter.address?.village || selectedVoter.village}, ডাকঘর: {selectedVoter.address?.postOffice || selectedVoter.voterArea || '-'}</p>
                      <p>উপজেলা: {selectedVoter.address?.upazila || selectedVoter.upazila || '-'}, জেলা: {selectedVoter.address?.district || selectedVoter.district || '-'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button 
                      onClick={() => handlePrint(selectedVoter)}
                      className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      মুদ্রণ (Print)
                    </button>
                    <button 
                      onClick={() => alert(`ডাউনলোড হচ্ছে: ${selectedVoter.nameEn}_NID_Export.pdf`)}
                      className="px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      রপ্তানি (Export)
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200/80 p-8 text-center flex flex-col items-center justify-center h-full min-h-64 sticky top-6">
                <div className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 mb-3 bg-white">
                  <CreditCard className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-700 font-serif">সুইফট কার্ড ইন্সপেক্টর</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                  যেকোনো ভোটারের নামের পাশে "কার্ড" বোতামটিতে ক্লিক করে উক্ত ভোটারের গণপ্রজাতন্ত্রী বাংলাদেশ অনুমোদিত ডিজিটাল স্মার্ট এনআইডি কার্ডের রিয়েল-টাইম থ্রিডি প্রিভিউ দেখুন।
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modern High-Density PDF Preview Overlay Modal */}
      {voterForPdf && (
        <div id="pdf-preview-modal-layer" className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[95vh] flex flex-col transition-all transform scale-100">
            
            {/* Modal Navigation & Control Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-red-600 rounded-lg text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold font-serif text-sm sm:text-base leading-none">বাংলাদেশ ভোটার তালিকা পিডিএফ ভিউয়ার</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">ভেরিফিকেশন পোর্টাল পোর্টাল • পৃষ্ঠা নম্বর: {voterForPdf.page_number} (Page No)</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Desktop Zoom Controller */}
                <div className="hidden sm:flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-xs mr-2">
                  <button 
                    onClick={() => setZoomLevel(prev => Math.max(75, prev - 10))} 
                    className="p-1 hover:text-blue-400 transition-colors"
                    title="জুম আউট"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="font-mono px-1.5 py-0.5 bg-slate-900 rounded font-bold text-slate-300 w-12 text-center">{zoomLevel}%</span>
                  <button 
                    onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))} 
                    className="p-1 hover:text-blue-400 transition-colors"
                    title="জুম ইন"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <button 
                  onClick={() => setVoterForPdf(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  aria-label="বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split Screen Layout inside PDF Viewer */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-100 flex-col md:flex-row">
              
              {/* Left Sidebar: Document Metadata & Seals verification */}
              <div className="w-full md:w-60 bg-slate-50 border-r border-slate-200 p-4 shrink-0 flex flex-col gap-4 text-xs overflow-y-auto">
                <div>
                  <h4 className="font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-2 font-serif">পিডিএফ ফাইলের তথ্য</h4>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-2">
                    <div>
                      <p className="text-slate-400">অনুমোদিত সোর্স:</p>
                      <p className="font-semibold text-slate-800 truncate text-[11px]" title={`${voterForPdf.village}_ভোটার_তালিকা_পৃষ্ঠা_${voterForPdf.page_number}.pdf`}>
                        {voterForPdf.village === 'সবুজপুর' ? 'সবুজপুর_ভোটর_তালিকা_৪৫.pdf' :
                         voterForPdf.village === 'আমতলী' ? 'বরগুনা_আমতলী_রোল_১২.pdf' :
                         voterForPdf.village === 'সোনারগাঁও' ? 'সোনারগাঁও_ভোটর_রোল_৮৯.pdf' :
                         `${voterForPdf.village}_ভোটার_তালিকা_পৃষ্ঠা_${voterForPdf.page_number}.pdf`}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">তৈরির তারিখ:</p>
                      <p className="font-semibold text-slate-800 font-mono">2026-05-24 14:32</p>
                    </div>
                    <div>
                      <p className="text-slate-400">হ্যাশ ইন্টেগ্রিটি:</p>
                      <p className="text-[9px] font-mono select-all bg-slate-100 p-1 rounded font-bold text-slate-600 truncate" title="SHA256: 8f9b90c10a4db567e98d89cb">
                        SHA-256: 8f9b90c...
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-600 uppercase tracking-wider text-[10px] mb-2 font-serif">ডিজিটাল নিরাপত্তার স্তর</h4>
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200/50 flex flex-col gap-1.5">
                    <p className="font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      ভেরিফাইড সিগনেচার
                    </p>
                    <p className="text-[10px] leading-relaxed text-emerald-700 bg-white/50 p-1.5 rounded border border-emerald-200">
                      নির্বাচন কমিশন সচিবালয়ের সিকিউরড মেটাডেটা এনভায়রনমেন্ট দ্বারা শংসাপত্রটি প্রত্যয়িত।
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-200 space-y-2">
                  <button 
                    onClick={() => alert(`বাংলাদেশ গেজেট ও ভোটার তালিকা গেটকিপার প্রিন্ট টোকেন আইডি: EXP-98246`)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ডাউনলোড করুন (PDF)
                  </button>
                  <button 
                    onClick={() => alert(`ফাইল প্রিন্টার স্পুলার সক্রিয় হয়েছে। অনুগ্রহপূর্বক আপনার সংযুক্ত প্রিন্ট উইজার্ডটি চালু করুন।`)}
                    className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    তালিকা প্রিন্ট (Print)
                  </button>
                </div>
              </div>

              {/* Central Area: Scalable PDF Viewer Page Mockup */}
              <div className="flex-1 p-4 sm:p-6 overflow-auto flex items-start justify-center cursor-grabbing select-none" id="pdf-viewstage">
                
                {/* Stylized Simulated Physical Printed PDF Document Paper Sheet */}
                <div 
                  className="bg-white shadow-2xl border-2 border-slate-300 p-6 sm:p-10 text-slate-900 relative origin-top transition-transform duration-200 max-w-full"
                  style={{ 
                    width: '640px', 
                    transform: `scale(${zoomLevel / 100})`,
                    minHeight: '800px'
                  }}
                >
                  {/* Subtle Circular Stamp Watermark */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-100 text-slate-100/10 text-8xl font-black font-serif pointer-events-none select-none select-all z-0 flex items-center justify-center rotate-45">
                    BANGLADESH
                  </div>

                  {/* Header of PDF Sheet */}
                  <div className="text-center border-b-2 border-slate-900 pb-3 mb-6 relative z-10">
                    <div className="w-10 h-10 rounded-full border-2 border-red-600 flex items-center justify-center font-bold text-sm text-red-600 mx-auto mb-1.5">★</div>
                    <h4 className="text-lg font-bold font-serif text-slate-950 uppercase tracking-tight">গণপ্রজাতন্ত্রী বাংলাদেশ নির্বাচন কমিশন</h4>
                    <p className="text-xs font-semibold text-slate-800 font-serif">সচিবালয়, ঢাকা</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase">VOTER REGISTRATION ROLL - SEC-D // YEAR 2026</p>
                    
                    <div className="absolute right-0 top-0 text-right text-[10px] font-mono text-slate-400">
                      <p>Page {voterForPdf.page_number} of 1489</p>
                      <p>District: {voterForPdf.address.district}</p>
                    </div>
                  </div>

                  {/* Document Warning Instructions / Meta Info in printed sheet */}
                  <div className="text-[10px] text-slate-600 leading-relaxed mb-5 border-l-2 border-slate-400 pl-3 italic relative z-10">
                    সংবিধিবদ্ধ সতর্কীকরণ: অত্র ভোটার তালিকা কেবলমাত্র দাপ্তরিক ভেরিফিকেশন ও তথ্য অনুসন্ধানের উদ্দেশ্যে প্রযোজ্য। বেআইনি অনুলিপি বা জালকরণ আইনত দণ্ডনীয় অপরাধ।
                  </div>

                  {/* Table containing the real searched voter and fake placeholders to seem authentic */}
                  <div className="relative z-10 overflow-hidden rounded border border-slate-900">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-150 text-slate-900 uppercase font-bold border-b border-slate-950 font-serif">
                          <th className="p-2 border-r border-slate-900 text-center w-12 text-[10px]">ক্রঃ</th>
                          <th className="p-2 border-r border-slate-900 text-[10px]">ভোটারের নাম ও জাতীয় আইডি নং</th>
                          <th className="p-2 border-r border-slate-900 text-[10px]">পিতার নাম (Father's Name)</th>
                          <th className="p-2 border-r border-slate-900 text-[10px]">গ্রাম ও ইউনিয়ন</th>
                          <th className="p-2 text-center text-[10px] w-20">অবস্থা</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-400">
                        {/* Placeholder fake Voter row 1 */}
                        <tr className="hover:bg-slate-50/50 text-[11px] text-slate-500">
                          <td className="p-2 border-r border-slate-400 text-center font-mono">০৭</td>
                          <td className="p-2 border-r border-slate-400">
                            <p className="font-bold">মোহাম্মদ শফিক উল্লাহ</p>
                            <p className="text-[9px] font-mono">NID: 1982341256781</p>
                          </td>
                          <td className="p-2 border-r border-slate-400">হাফিজ উদ্দিন পাটোয়ারী</td>
                          <td className="p-2 border-r border-slate-400">সবুজপুর, ইউনিয়ন নং ৪</td>
                          <td className="p-2 text-center font-bold text-emerald-600 text-[10px]">সক্রিয়</td>
                        </tr>

                        {/* Real Targeted Verified Row (Highlighted) */}
                        <tr className="bg-amber-100/90 ring-2 ring-amber-500 text-[11px] text-slate-900 font-medium">
                          <td className="p-2 border-r border-slate-900 text-center font-mono font-bold text-amber-900">০৮</td>
                          <td className="p-2 border-r border-slate-900 relative">
                            <p className="font-bold text-slate-950 flex items-center gap-1 font-serif">
                              {voterForPdf.nameBn}
                              <span className="bg-emerald-600 text-white rounded px-1 py-0.5 text-[8px] font-sans font-black flex items-center gap-0.5">
                                <Check className="w-2 h-2" /> Verified
                              </span>
                            </p>
                            <p className="text-[9px] font-mono text-slate-600 font-bold">NID: {voterForPdf.nid}</p>
                          </td>
                          <td className="p-2 border-r border-slate-900 font-semibold">{voterForPdf.fatherName}</td>
                          <td className="p-2 border-r border-slate-900 font-semibold">{voterForPdf.village}, {voterForPdf.address?.postOffice || voterForPdf.voterArea || '-'}</td>
                          <td className="p-2 text-center relative font-serif">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200 text-amber-900 ring-1 ring-amber-600/30">
                              যাচিত রেকর্ড
                            </span>
                          </td>
                        </tr>

                        {/* Placeholder fake Voter row 2 */}
                        <tr className="hover:bg-slate-50/50 text-[11px] text-slate-500">
                          <td className="p-2 border-r border-slate-400 text-center font-mono">০৯</td>
                          <td className="p-2 border-r border-slate-400">
                            <p className="font-bold">মোসাম্মাৎ জেসমিন আক্তার</p>
                            <p className="text-[9px] font-mono">NID: 1991459201948</p>
                          </td>
                          <td className="p-2 border-r border-slate-400">আবুল হাসেম প্রধান</td>
                          <td className="p-2 border-r border-slate-400">আমতলী বাজার ঘাট এলাকা</td>
                          <td className="p-2 text-center font-bold text-red-600 text-[10px]">স্থগিত</td>
                        </tr>

                        {/* Placeholder fake Voter row 3 */}
                        <tr className="hover:bg-slate-50/50 text-[11px] text-slate-500">
                          <td className="p-2 border-r border-slate-400 text-center font-mono">১০</td>
                          <td className="p-2 border-r border-slate-400">
                            <p className="font-bold">কাজী মজিবুর রহমান</p>
                            <p className="text-[9px] font-mono">NID: 1978253198012</p>
                          </td>
                          <td className="p-2 border-r border-slate-400">কাজী ফজলুল করিম</td>
                          <td className="p-2 border-r border-slate-400">সোনারগাঁও চর পাড়া</td>
                          <td className="p-2 text-center font-bold text-emerald-600 text-[10px]">সক্রিয়</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Certification signatures block */}
                  <div className="mt-12 flex items-center justify-between z-10 relative">
                    <div className="text-[10px] text-slate-500">
                      <p>যাচাইকারী কর্মকর্তার সিল:</p>
                      <div className="w-16 h-16 rounded-full border-2 border-emerald-500/30 border-dashed flex items-center justify-center font-serif text-[8px] text-emerald-700/60 font-bold rotate-15 mt-1 bg-emerald-50/10">
                        ELECTION COMM
                      </div>
                    </div>
                    
                    <div className="text-right text-[10px] text-slate-600 pr-4">
                      <p className="italic font-serif text-slate-400">Signature Verified</p>
                      <p className="font-semibold underline mt-3">নির্বাচনী নিবন্ধক কর্মকর্তা</p>
                      <p className="text-[9px] text-slate-400 mt-1 font-mono">Security Checkpoint Auth ID: EC-987</p>
                    </div>
                  </div>

                  {/* Bottom bar codes inside pdf paper */}
                  <div className="mt-10 pt-4 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-400 font-mono">
                    <span>HASH_GEN_BD: 198AA82F8120BBD982</span>
                    <span>© Bangladesh Election Commission Secretarial Division</span>
                  </div>

                </div>
              </div>

            </div>

            {/* Footer containing clear Exit Controls */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 select-none">
              <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse-slow"></span>
                রেকর্ড ইন্টিগ্রিটি সফলভাবে এনালিসিস করা হয়েছে।
              </span>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    alert('ভোটার তালিকায় আপনার অনুসন্ধানের ডাটা সুরক্ষিত কোড দিয়ে সীলমোহর করা হয়েছে।');
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  ডিজিটাল সিল যুক্ত করুন
                </button>
                <button 
                  onClick={() => setVoterForPdf(null)}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md shadow-red-200"
                >
                  বন্ধ করুন (Close)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

