import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, FileText, Shield, Sparkles, Award, CheckCircle2, ChevronRight } from 'lucide-react';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab: 'guide' | 'terms' | 'privacy';
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose, defaultTab }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'terms' | 'privacy'>(defaultTab);

  // Sync active tab with defaultTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'guide' as const, label: 'ইউজার গাইড', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'terms' as const, label: 'ব্যবহারের শর্তাবলী', icon: <FileText className="w-4 h-4" /> },
    { id: 'privacy' as const, label: 'গোপনীয়তা নীতি', icon: <Shield className="w-4 h-4" /> },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto custom-scrollbar flex items-start justify-center p-4 sm:p-6 md:p-10 bg-slate-950/85 backdrop-blur-md select-none animate-in fade-in duration-300">
      
      {/* Glow effects in background */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Modal Container */}
      <div className="bg-slate-900/95 border border-slate-800/80 text-white rounded-3xl overflow-hidden shadow-2xl relative max-w-3xl w-full mx-auto my-auto transform transition-all duration-500 scale-100 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        
        {/* Banner / Header */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 border-b border-slate-800/60 p-6 sm:p-8 relative">
          
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-950/40 hover:bg-slate-950/70 border border-white/10 rounded-full text-white/80 hover:text-white transition-all cursor-pointer hover:rotate-90 duration-300"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Sparkle background elements */}
          <div className="absolute top-3 left-4 text-white/20 animate-pulse"><Sparkles className="w-4 h-4" /></div>
          
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold font-serif bg-gradient-to-r from-white to-slate-300 text-transparent bg-clip-text">
              নথি ও সহায়িকা কেন্দ্র
            </h2>
            <p className="text-xs text-slate-400">
              ডিজিটাল ভোটার অনুসন্ধান ও ব্যবস্থাপনা সিস্টেম ব্যবহারের গাইডলাইন ও নিয়মাবলী
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 mt-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border flex items-center gap-2 transition-all duration-300 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300 shadow-md shadow-teal-950/50'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* TAB 1: USER GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                <span className="w-1.5 h-3 bg-teal-500 rounded-xs"></span>
                <h3 className="font-bold text-xs tracking-widest text-slate-400 uppercase">ইউজার গাইড (User Guide)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Step 1 */}
                <div className="bg-slate-950/30 border border-slate-800/50 p-5 rounded-2xl space-y-2 hover:border-slate-700/60 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 flex items-center justify-center font-bold text-xs font-mono">১</span>
                    <h4 className="font-bold text-sm text-slate-200">সার্চ ফিল্টারিং</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    ভোটার তালিকা অনুসন্ধানের জন্য সার্চ ফর্মটিতে নাম, পিতার নাম, মাতার নাম বা নির্দিষ্ট গ্রামের নাম বাংলায় সঠিকভাবে লিখুন।
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-950/30 border border-slate-800/50 p-5 rounded-2xl space-y-2 hover:border-slate-700/60 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 flex items-center justify-center font-bold text-xs font-mono">২</span>
                    <h4 className="font-bold text-sm text-slate-200">পিডিএফ ভেরিফিকেশন</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    অনুসন্ধান ফলাফলে কাঙ্ক্ষিত ভোটারের কার্ডে থাকা <strong className="text-teal-400">ভেরিফাই করুন</strong> বাটনে ক্লিক করলে ভোটার তালিকা পিডিএফ থেকে সরাসরি মূল কার্ডের অবস্থান দেখানো হবে।
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-950/30 border border-slate-800/50 p-5 rounded-2xl space-y-2 hover:border-slate-700/60 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 flex items-center justify-center font-bold text-xs font-mono">৩</span>
                    <h4 className="font-bold text-sm text-slate-200">আইডি কার্ড ডাউনলোড</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    ভোটারের তথ্যের সঠিকতা যাচাই করার পর <strong className="text-emerald-400">ডাউনলোড (JPG)</strong> বাটনে ক্লিক করে একটি ডিজিটাল ভোটার কার্ড ইমেজ হিসেবে সংরক্ষণ করতে পারেন।
                  </p>
                </div>

                {/* Step 4 */}
                <div className="bg-slate-950/30 border border-slate-800/50 p-5 rounded-2xl space-y-2 hover:border-slate-700/60 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 flex items-center justify-center font-bold text-xs font-mono">৪</span>
                    <h4 className="font-bold text-sm text-slate-200">অ্যাডমিন ড্যাশবোর্ড</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    নতুন ভোটার ডাটা ও পিডিএফ আপলোড করার জন্য ফুটারে থাকা <strong className="text-teal-400">এডমিন কন্ট্রোল লগইন</strong> বাটনে ক্লিক করে সিকিউরড ড্যাশবোর্ডে প্রবেশ করুন।
                  </p>
                </div>

              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 items-start">
                <span className="shrink-0 text-amber-400 mt-0.5">⚠️</span>
                <div className="space-y-1">
                  <h5 className="font-bold text-xs text-amber-300">ফন্ট ভেঙে যাওয়ার টিপস:</h5>
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">
                    ভোটার তালিকা ফাইলের ফন্ট এনকোডিং সীমাবদ্ধতার কারণে কিছু নামের বানান আংশিক ভেঙে যেতে পারে। এয়ারপোর্ট বা অন্য স্থানে মিলানোর সুবিধার্থে সম্পূর্ণ নাম না দিয়ে নামের প্রধান অংশ (যেমন: "ছিদ্দিক" বা "তৈয়ব") দিয়ে সার্চ করুন।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TERMS AND CONDITIONS */}
          {activeTab === 'terms' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                <span className="w-1.5 h-3 bg-teal-500 rounded-xs"></span>
                <h3 className="font-bold text-xs tracking-widest text-slate-400 uppercase">ব্যবহারের শর্তাবলী (Terms & Conditions)</h3>
              </div>

              <div className="space-y-4 text-slate-300 text-xs sm:text-sm leading-relaxed">
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>তথ্য যাচাইকরণ:</strong> এই সিস্টেমে প্রদর্শিত ভোটার তথ্যসমূহ শুধুমাত্র অনুসন্ধান ও প্রাথমিক যাচাইয়ের কাজে ব্যবহারের জন্য। অফিসিয়াল বা আইনি প্রয়োজনে মূল ভোটার তালিকার সাথে মিলানো আবশ্যক।
                  </p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>ব্যক্তিগত ব্যবহার:</strong> সিস্টেমটি শুধুমাত্র অনুমোদিত দাতব্য বা প্রাতিষ্ঠানিক কাজে ভোটার তথ্য বিশ্লেষণের উদ্দেশ্যে ব্যবহার করা যাবে। কোনো অসৎ উদ্দেশ্যে তথ্য সংগ্রহ সম্পূর্ণ অবৈধ।
                  </p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>ফাইলের নিরাপত্তা:</strong> আপলোডকৃত পিডিএফের তথ্যের মালিকানা সংশ্লিষ্ট ব্যবহারকারীর। সিস্টেমে ব্যবহৃত ডেমো ডাটা বা আপলোডকৃত ফাইলের অপব্যবহার রোধে কঠোর এনক্রিপশন প্রোটোকল অনুসরণ করা হয়।
                  </p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>সীমাবদ্ধতা:</strong> ডেভেলপার বা সিস্টেম কর্তৃপক্ষ ভোটার তালিকা ডাটার কোনো প্রকার ভুল বা ডেভিয়েশনের কারণে প্রত্যক্ষ বা পরোক্ষ ক্ষতির জন্য দায়ী থাকবেন না।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                <span className="w-1.5 h-3 bg-teal-500 rounded-xs"></span>
                <h3 className="font-bold text-xs tracking-widest text-slate-400 uppercase">গোপনীয়তা নীতি (Privacy Policy)</h3>
              </div>

              <div className="space-y-4 text-slate-300 text-xs sm:text-sm leading-relaxed">
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>ডাটা এনক্রিপশন:</strong> অনুসন্ধানকৃত সকল ভোটার রেকর্ড বা ব্যক্তিগত পরিচিতি সম্পর্কিত তথ্য লোকাল ডাটাবেজে সুরক্ষিতভাবে পরিচালিত হয়। অননুমোদিত কেউ ডাটা রিড করতে পারে না।
                  </p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>ফাইলের গোপনীয়তা:</strong> আপলোডকৃত প্রতিটি পিডিএফ ফাইল সিস্টেমের রুট ডিরেক্টরিতে সুরক্ষিতভাবে জমা থাকে এবং শুধুমাত্র অনুমোদিত কুয়েরি এক্সট্রাক্টর মডিউল ব্যতীত বাইরের কোনো নেটওয়ার্ক থেকে ফাইলগুলোর ডাউনলোডযোগ্য ইউআরএল অ্যাক্সেস করা সম্ভব নয়।
                  </p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>অ্যাক্টিভিটি লগ:</strong> সিস্টেম সিকিউরিটি বৃদ্ধির লক্ষ্যে এবং অননুমোদিত অ্যাক্সেস ব্লক করতে প্রতিটি সার্চ কুয়েরির ন্যূনতম টেকনিক্যাল মেটাডাটা (যেমন: অনুসন্ধান টার্ম ও সময়) সিকিউরড অ্যাডমিন লগে জমা রাখা হয়।
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer (Action Panel) */}
        <div className="bg-slate-950/80 border-t border-slate-800/80 px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <span>লাইভ ভোটার পোর্টাল নথি ও সহায়িকা কেন্দ্র</span>
          </div>

          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-md shadow-slate-950 transition-all duration-300 cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
