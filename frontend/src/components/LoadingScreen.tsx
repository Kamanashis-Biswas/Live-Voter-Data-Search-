import React, { useEffect, useState } from 'react';
import { Database, Wifi, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  progress: number;
  onBypass: () => void;
}

const toBangla = (n: number | string): string => {
  const d = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  return String(n).split('').map(c => { const i = parseInt(c); return isNaN(i) ? c : d[i]; }).join('');
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, onBypass }) => {
  const [statusText, setStatusText] = useState('সার্ভার সংযোগ স্থাপন করা হচ্ছে...');
  const [showBypass, setShowBypass] = useState(false);

  // Dynamically update status text based on elapsed time to guide the user
  useEffect(() => {
    const t1 = setTimeout(() => {
      setStatusText('Render সার্ভার ঘুমন্ত অবস্থা থেকে জাগ্রত হচ্ছে...');
    }, 5000);

    const t2 = setTimeout(() => {
      setStatusText('Render সার্ভার নিষ্ক্রিয় ছিল, বুট হতে প্রায় ৪০ সেকেন্ড সময় লাগে...');
    }, 12000);

    const t3 = setTimeout(() => {
      setStatusText('সংযোগ পরীক্ষা করা হচ্ছে, অনুগ্রহ করে একটু অপেক্ষা করুন...');
    }, 25000);

    // Show the offline bypass button after 8 seconds of unsuccessful connection
    const bypassTimer = setTimeout(() => {
      setShowBypass(true);
    }, 8000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(bypassTimer);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0, 
        scale: 1.05, 
        filter: 'blur(10px)',
        transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } 
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 text-slate-100 select-none overflow-hidden"
    >
      {/* Ambient background glows */}
      <div className="absolute top-[20%] left-[10%] w-[35vw] h-[35vw] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[20%] right-[10%] w-[40vw] h-[40vw] bg-indigo-500/8 rounded-full blur-[140px] pointer-events-none animate-pulse-slow"></div>

      {/* Main Container Card */}
      <div className="z-10 flex flex-col items-center max-w-md w-full px-6 text-center">
        
        {/* Pulsing Database/Shield Icon */}
        <div className="relative mb-8">
          <div className="absolute -inset-4 bg-teal-500/20 rounded-full blur-xl animate-pulse"></div>
          <div className="w-20 h-20 bg-slate-900/90 rounded-full border border-teal-500/30 flex items-center justify-center text-teal-400 relative z-10 shadow-2xl">
            <Database className="w-9 h-9 animate-pulse" />
          </div>
          {/* Radial ripple rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-teal-500/10 rounded-full animate-ping opacity-40"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 border border-indigo-500/5 rounded-full animate-ping opacity-25" style={{ animationDelay: '0.5s' }}></div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold tracking-tight font-serif bg-gradient-to-r from-white via-slate-100 to-teal-300 text-transparent bg-clip-text">
          লাইভ ভোটার পোর্টাল
        </h1>
        <p className="text-xs text-slate-400 font-mono tracking-widest uppercase mt-1">
          Live Voter Search Portal
        </p>

        {/* Progress Display */}
        <div className="mt-10 mb-4 flex flex-col items-center">
          <span className="text-4xl font-black font-mono tracking-wider text-teal-300 select-none">
            {toBangla(progress)}%
          </span>
          <span className="text-xs text-slate-400 font-medium tracking-wide mt-2 font-mono">
            {progress < 100 ? 'LOADING ASSETS...' : 'SYSTEM READY'}
          </span>
        </div>

        {/* Loading Bar */}
        <div className="w-64 sm:w-80 h-2.5 bg-slate-900/90 border border-white/5 rounded-full overflow-hidden relative shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 rounded-full transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Glossy light sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent w-20 animate-[pulse_1.5s_infinite] right-0"></div>
          </div>
        </div>

        {/* Subtitle / Dynamic Status */}
        <div className="h-12 flex items-center justify-center mt-6">
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-sm leading-relaxed animate-pulse">
            {statusText}
          </p>
        </div>

        {/* Action Bypass Button */}
        <div className="h-16 flex items-center justify-center">
          {showBypass && progress < 100 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              onClick={onBypass}
              type="button"
              className="px-5 py-2.5 bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-teal-500/35 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 shadow-lg shadow-black/30 cursor-pointer"
            >
              <Wifi className="w-4 h-4 text-teal-400 animate-pulse" />
              সরাসরি প্রবেশ করুন ( অফলাইন মোড )
            </motion.button>
          )}
        </div>

      </div>

      {/* Footer Info */}
      <div className="absolute bottom-6 text-[10px] text-slate-500 text-center max-w-xs px-4 leading-relaxed font-mono">
        Render Free tier spins down after 15 mins of inactivity. Server spin-up takes ~40-50 seconds.
      </div>
    </motion.div>
  );
};
