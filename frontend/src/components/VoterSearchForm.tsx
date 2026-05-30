import React, { useState } from 'react';
import { Search, RotateCcw, User, MapPin, Calendar } from 'lucide-react';
import { SearchFilters } from '../types';

interface VoterSearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  onReset: () => void;
}

const initialFilters: SearchFilters = {
  name: '',
  fatherName: '',
  motherName: '',
  village: '',
  dob: '',
  gender: 'all',
};

export const VoterSearchForm: React.FC<VoterSearchFormProps> = ({ onSearch, onReset }) => {
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
  };

  const handleResetClick = () => {
    setFilters(initialFilters);
    onReset();
  };

  return (
    <div id="voter-search-form-container" className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Card Accent Header from High Density Theme */}
      <div className="h-1.5 w-full bg-gradient-to-r from-red-600 to-blue-700"></div>
      
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">লাইভ ভোটার ডাটা সার্চ</h1>
            <p className="text-sm text-slate-500">জাতীয় তথ্যভাণ্ডার থেকে ভোটারের তথ্য অনুসন্ধান করুন</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase tracking-tighter border border-blue-100">Database: Live</span>
            <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded uppercase tracking-tighter border border-green-100 font-mono">Connected</span>
          </div>
        </div>

        {/* Search Form Grid Layout (High Density Col-2 desktop pattern) */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          
          {/* Name Input */}
          <div className="col-span-1">
            <label htmlFor="name-input" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
              নাম (Name)
            </label>
            <input
              type="text"
              id="name-input"
              name="name"
              value={filters.name}
              onChange={handleInputChange}
              placeholder="ভোটারের পূর্ণ নাম লিখুন"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Village Input */}
          <div className="col-span-1">
            <label htmlFor="village-input" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
              গ্রাম (Village)
            </label>
            <input
              type="text"
              id="village-input"
              name="village"
              value={filters.village}
              onChange={handleInputChange}
              placeholder="গ্রামের নাম"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Father's Name Input */}
          <div className="col-span-1">
            <label htmlFor="fatherName-input" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
              পিতার নাম (Father's Name)
            </label>
            <input
              type="text"
              id="fatherName-input"
              name="fatherName"
              value={filters.fatherName}
              onChange={handleInputChange}
              placeholder="পিতার নাম লিখুন"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Mother's Name Input */}
          <div className="col-span-1">
            <label htmlFor="motherName-input" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
              মাতার নাম (Mother's Name)
            </label>
            <input
              type="text"
              id="motherName-input"
              name="motherName"
              value={filters.motherName}
              onChange={handleInputChange}
              placeholder="মাতার নাম লিখুন"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Date of Birth Input */}
          <div className="col-span-1">
            <label htmlFor="dob-input" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
              জন্ম তারিখ (Date of Birth - Optional)
            </label>
            <input
              type="date"
              id="dob-input"
              name="dob"
              value={filters.dob}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all text-slate-900"
            />
          </div>

          {/* Gender Select Input */}
          <div className="col-span-1">
            <label htmlFor="gender-input" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
              লিঙ্গ (Gender)
            </label>
            <select
              id="gender-input"
              name="gender"
              value={filters.gender}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all text-slate-900 cursor-pointer"
            >
              <option value="all">সব লিঙ্গ</option>
              <option value="male">পুরুষ</option>
              <option value="female">মহিলা</option>
            </select>
          </div>

          {/* Form Actions Section with exact visual specifications from design */}
          <div className="col-span-1 md:col-span-2 pt-4 flex flex-col sm:flex-row gap-4 justify-end">
            <button
              type="button"
              id="reset-filter-button"
              onClick={handleResetClick}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-50 text-red-700 font-bold rounded-lg border border-red-200 hover:bg-red-100 transition-colors w-full sm:w-auto cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              রিসেট
            </button>
            <button
              type="submit"
              id="submit-search-button"
              className="flex items-center justify-center gap-2 px-10 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg border border-blue-800 shadow-md shadow-blue-200 hover:shadow-lg transition-all w-full sm:w-auto cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              সার্চ
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
