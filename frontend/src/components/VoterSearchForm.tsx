import React, { useState } from 'react';
import { Search, RotateCcw, User, MapPin, Calendar, Loader2 } from 'lucide-react';
import { SearchFilters } from '../types';

interface VoterSearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  onReset: () => void;
  serverOnline?: boolean;
  searching?: boolean;
}

const initialFilters: SearchFilters = {
  name: '',
  fatherName: '',
  motherName: '',
  village: '',
  dob: '',
  gender: 'all',
  upazila: '',
  district: '',
  voterNo: '',
};

export const VoterSearchForm: React.FC<VoterSearchFormProps> = ({ 
  onSearch, 
  onReset,
  serverOnline = true,
  searching = false
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
    setFilters(initialFilters);
  };

  return (
    <div id="voter-search-form-container" className="backdrop-blur-md bg-white/75 border border-white/40 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-emerald-500/5">
      {/* Premium Accent Header */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600"></div>
      
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">লাইভ ভোটার ডাটা সার্চ</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">জাতীয় তথ্যভাণ্ডার থেকে ভোটারের তথ্য অনুসন্ধান করুন</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <span className="px-2 py-1 bg-teal-50/50 text-teal-700 text-[10px] font-bold rounded-md uppercase tracking-tighter border border-teal-200/50 font-mono select-none backdrop-blur-xs">Database: Live</span>
            {serverOnline ? (
              <span className="px-2 py-1 bg-emerald-50/50 text-emerald-700 text-[10px] font-bold rounded-md uppercase tracking-tighter border border-emerald-200/50 font-mono flex items-center gap-1.5 select-none backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
            ) : (
              <span className="px-2 py-1 bg-rose-50/50 text-rose-700 text-[10px] font-bold rounded-md uppercase tracking-tighter border border-rose-200/50 font-mono flex items-center gap-1.5 select-none animate-bounce backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Search Form Grid Layout (High Density Col-2 desktop pattern) */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          
          {/* Name Input */}
          <div className="col-span-1">
            <label htmlFor="name-input" className="block text-xs font-bold text-slate-600 mb-1.5">
              নাম
            </label>
            <input
              type="text"
              id="name-input"
              name="name"
              value={filters.name}
              onChange={handleInputChange}
              placeholder="ভোটারের পূর্ণ নাম লিখুন"
              className="w-full bg-white/50 backdrop-blur-xs border border-teal-500/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-hidden transition-all duration-300 text-slate-900 placeholder:text-slate-400 focus:bg-white/80 focus:shadow-md focus:shadow-teal-500/5"
            />
          </div>

          {/* Village Input */}
          <div className="col-span-1">
            <label htmlFor="village-input" className="block text-xs font-bold text-slate-600 mb-1.5">
              গ্রাম/মহল্লা
            </label>
            <input
              type="text"
              id="village-input"
              name="village"
              value={filters.village}
              onChange={handleInputChange}
              placeholder="গ্রাম বা এলাকার নাম লিখুন"
              className="w-full bg-white/50 backdrop-blur-xs border border-teal-500/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-hidden transition-all duration-300 text-slate-900 placeholder:text-slate-400 focus:bg-white/80 focus:shadow-md focus:shadow-teal-500/5"
            />
          </div>

          {/* Father's Name Input */}
          <div className="col-span-1">
            <label htmlFor="fatherName-input" className="block text-xs font-bold text-slate-600 mb-1.5">
              পিতার নাম
            </label>
            <input
              type="text"
              id="fatherName-input"
              name="fatherName"
              value={filters.fatherName}
              onChange={handleInputChange}
              placeholder="পিতার নাম লিখুন"
              className="w-full bg-white/50 backdrop-blur-xs border border-teal-500/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-hidden transition-all duration-300 text-slate-900 placeholder:text-slate-400 focus:bg-white/80 focus:shadow-md focus:shadow-teal-500/5"
            />
          </div>

          {/* Mother's Name Input */}
          <div className="col-span-1">
            <label htmlFor="motherName-input" className="block text-xs font-bold text-slate-600 mb-1.5">
              মাতার নাম
            </label>
            <input
              type="text"
              id="motherName-input"
              name="motherName"
              value={filters.motherName}
              onChange={handleInputChange}
              placeholder="মাতার নাম লিখুন"
              className="w-full bg-white/50 backdrop-blur-xs border border-teal-500/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-hidden transition-all duration-300 text-slate-900 placeholder:text-slate-400 focus:bg-white/80 focus:shadow-md focus:shadow-teal-500/5"
            />
          </div>

          {/* Date of Birth Input */}
          <div className="col-span-1">
            <label htmlFor="dob-input" className="block text-xs font-bold text-slate-600 mb-1.5">
              জন্ম তারিখ
            </label>
            <input
              type="date"
              id="dob-input"
              name="dob"
              value={filters.dob}
              onChange={handleInputChange}
              className="w-full bg-white/50 backdrop-blur-xs border border-teal-500/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-hidden transition-all duration-300 text-slate-900 focus:bg-white/80 focus:shadow-md focus:shadow-teal-500/5"
            />
          </div>

          {/* District Input */}
          <div className="col-span-1">
            <label htmlFor="district-input" className="block text-xs font-bold text-slate-600 mb-1.5">
              জেলা
            </label>
            <input
              type="text"
              id="district-input"
              name="district"
              value={filters.district}
              onChange={handleInputChange}
              placeholder="জেলার নাম লিখুন"
              className="w-full bg-white/50 backdrop-blur-xs border border-teal-500/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-hidden transition-all duration-300 text-slate-900 placeholder:text-slate-400 focus:bg-white/80 focus:shadow-md focus:shadow-teal-500/5"
            />
          </div>

          {/* Upazila Input */}
          <div className="col-span-1">
            <label htmlFor="upazila-input" className="block text-xs font-bold text-slate-600 mb-1.5">
              উপজেলা/থানা
            </label>
            <input
              type="text"
              id="upazila-input"
              name="upazila"
              value={filters.upazila}
              onChange={handleInputChange}
              placeholder="উপজেলার নাম লিখুন"
              className="w-full bg-white/50 backdrop-blur-xs border border-teal-500/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-hidden transition-all duration-300 text-slate-900 placeholder:text-slate-400 focus:bg-white/80 focus:shadow-md focus:shadow-teal-500/5"
            />
          </div>

          {/* Voter No Input */}
          <div className="col-span-1">
            <label htmlFor="voterNo-input" className="block text-xs font-bold text-slate-600 mb-1.5">
              ভোটার নম্বর
            </label>
            <input
              type="text"
              id="voterNo-input"
              name="voterNo"
              value={filters.voterNo}
              onChange={handleInputChange}
              placeholder="১৩ বা ১৭ সংখ্যার ভোটার নম্বর লিখুন"
              className="w-full bg-white/50 backdrop-blur-xs border border-teal-500/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-hidden transition-all duration-300 text-slate-900 placeholder:text-slate-400 focus:bg-white/80 focus:shadow-md focus:shadow-teal-500/5"
            />
          </div>

          {/* Form Actions Section with premium responsive style */}
          <div className="col-span-1 md:col-span-2 pt-4 flex flex-col sm:flex-row gap-4 justify-end">
            <button
              type="submit"
              id="submit-search-button"
              disabled={searching}
              className="flex items-center justify-center gap-2 px-10 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl border-none shadow-lg shadow-teal-500/10 hover:shadow-teal-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  সার্চ হচ্ছে...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  সার্চ করুন
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
