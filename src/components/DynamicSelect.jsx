import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';

export default function DynamicSelect({ 
  value, 
  onChange, 
  optionsKey,
  defaultOptions = [], 
  placeholder = 'Select or type...' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState([]);
  const wrapperRef = useRef(null);

  // Initialize options from local storage + defaults
  useEffect(() => {
    if(!optionsKey) {
      setOptions(defaultOptions);
      return;
    }
    const saved = localStorage.getItem(`dynamicSelect_${optionsKey}`);
    if (saved) {
      setOptions(JSON.parse(saved));
    } else {
      setOptions(defaultOptions);
      localStorage.setItem(`dynamicSelect_${optionsKey}`, JSON.stringify(defaultOptions));
    }
  }, [optionsKey, defaultOptions.join(',')]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleAddCustom = () => {
    if (!searchTerm.trim()) return;
    const newOption = searchTerm.trim();
    if (!options.includes(newOption)) {
      const newOptions = [...options, newOption];
      setOptions(newOptions);
      if(optionsKey) {
        localStorage.setItem(`dynamicSelect_${optionsKey}`, JSON.stringify(newOptions));
      }
    }
    handleSelect(newOption);
  };

  const handleRemoveOption = (e, optionToRemove) => {
    e.stopPropagation();
    const newOptions = options.filter(opt => opt !== optionToRemove);
    setOptions(newOptions);
    if(optionsKey) {
      localStorage.setItem(`dynamicSelect_${optionsKey}`, JSON.stringify(newOptions));
    }
  };

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className="flex items-center justify-between w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 cursor-text focus-within:ring-2 focus-within:ring-blue-500 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition-all font-sans"
        onClick={() => setIsOpen(true)}
      >
        <input 
            type="text" 
            className="w-full bg-transparent outline-none flex-1 min-w-0"
            placeholder={value || placeholder}
            value={isOpen ? searchTerm : value}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
        />
        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 cursor-pointer" onClick={(e) => {
           e.stopPropagation();
           setIsOpen(!isOpen);
        }} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            <ul className="py-1">
              {filteredOptions.map((opt) => (
                <li 
                  key={opt} 
                  onClick={() => handleSelect(opt)}
                  className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors flex justify-between items-center group"
                >
                  <span className="truncate">{opt}</span>
                  <button 
                     onClick={(e) => handleRemoveOption(e, opt)}
                     className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                     title="Remove option"
                     type="button"
                  >
                     <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
               No matches found.
            </div>
          )}
          
          {searchTerm.trim() && !options.some(opt => opt.toLowerCase() === searchTerm.toLowerCase()) && (
            <div 
              onClick={handleAddCustom}
              className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
