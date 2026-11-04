/**
 * CreatableSelect — Enterprise Editable Dropdown with "Add New" Capability
 * - Displays predefined standard options alongside custom values stored permanently in DB
 * - Search filter allows quick lookup of any option
 * - If typed text does not match an existing option, an "Add New" button appears
 * - Clicking "Add New" or pressing Enter saves the new option permanently to the database
 * - Automatically selects the new option and updates cache for all other asset forms
 * - Case-insensitive deduplication prevents accidental duplicate entries
 * - 100% theme-consistent (Euro Motors premium dark mode + light mode)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, Plus, Check, Loader2, Search, X } from 'lucide-react';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

// Shared module-level cache for custom dropdown options
const globalOptionsCache = {};

export default function CreatableSelect({
  field,
  defaults = [],
  value = '',
  onChange,
  placeholder = 'Select or type to add...',
  disabled = false,
  className = '',
  triggerClassName = '',
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customOptions, setCustomOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch saved custom options for this field from the backend
  const loadCustomOptions = useCallback(async (force = false) => {
    if (!force && globalOptionsCache[field] !== undefined) {
      setCustomOptions(globalOptionsCache[field]);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/dropdown-options/${field}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        globalOptionsCache[field] = list;
        setCustomOptions(list);
      }
    } catch (_) {
      // Safe fallback: static defaults remain functional even if backend is offline
    }
  }, [field]);

  useEffect(() => {
    loadCustomOptions();
  }, [loadCustomOptions]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Merge standard defaults with user-saved custom options (deduplicated)
  const combinedOptions = useMemo(() => {
    const set = new Set();
    const result = [];

    // Add standard defaults first
    for (const item of defaults) {
      const lower = item.toLowerCase();
      if (!set.has(lower)) {
        set.add(lower);
        result.push({ label: item, isCustom: false });
      }
    }

    // Add custom options from database
    for (const item of customOptions) {
      const lower = item.toLowerCase();
      if (!set.has(lower)) {
        set.add(lower);
        result.push({ label: item, isCustom: true });
      }
    }

    // Ensure currently selected value is present even if legacy/unlisted
    if (value && !set.has(value.toLowerCase())) {
      result.unshift({ label: value, isCustom: true });
    }

    return result;
  }, [defaults, customOptions, value]);

  // Filter options based on search query
  const trimmedSearch = search.trim();
  const filtered = useMemo(() => {
    if (!trimmedSearch) return combinedOptions;
    const q = trimmedSearch.toLowerCase();
    return combinedOptions.filter(opt => opt.label.toLowerCase().includes(q));
  }, [combinedOptions, trimmedSearch]);

  // Check if typed search is genuinely new (not in any existing option)
  const isNewValue = useMemo(() => {
    if (!trimmedSearch) return false;
    const q = trimmedSearch.toLowerCase();
    return !combinedOptions.some(opt => opt.label.toLowerCase() === q);
  }, [combinedOptions, trimmedSearch]);

  const handleSelect = (optionLabel) => {
    onChange(optionLabel);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Add new custom option permanently to DB
  const handleAddNew = async () => {
    if (!trimmedSearch || saving) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/dropdown-options/${field}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: trimmedSearch })
      });

      if (res.ok) {
        delete globalOptionsCache[field];
        await loadCustomOptions(true);
      }
      
      // Update form state with new value
      onChange(trimmedSearch);
      setIsOpen(false);
      setSearch('');
    } catch (_) {
      // Optimistic update
      onChange(trimmedSearch);
      setIsOpen(false);
      setSearch('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <div
        onClick={handleOpen}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm rounded-xl border transition-all cursor-pointer select-none
          ${disabled
            ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 opacity-60 cursor-not-allowed'
            : isOpen
              ? 'bg-white dark:bg-[#0c1322] border-blue-500 ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-[#0c1322] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }
          ${triggerClassName}
        `}
      >
        <div className="flex-1 truncate">
          {value ? (
            <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-md transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
        </div>
      </div>

      {/* Hidden input to support native form validation if required */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Search & Add Input Box */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isNewValue) {
                      handleAddNew();
                    } else if (filtered.length > 0) {
                      handleSelect(filtered[0].label);
                    }
                  }
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                    setSearch('');
                  }
                }}
                placeholder="Type to filter or add new..."
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-xs rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick "Add New" Action Prompt if search text is new */}
          {isNewValue && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-blue-50/70 dark:bg-blue-950/30">
              <button
                type="button"
                onClick={handleAddNew}
                disabled={saving}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-60"
              >
                <div className="flex items-center gap-2 truncate">
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">Add new &quot;{trimmedSearch}&quot;</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-700 text-blue-100 shrink-0">
                  Save to DB
                </span>
              </button>
            </div>
          )}

          {/* Options Scroll Container */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-transparent">
            {filtered.length === 0 && !isNewValue && (
              <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No matching options found. Type above to add a new one.
              </div>
            )}

            {filtered.map((opt) => {
              const isSelected = value === opt.label;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleSelect(opt.label)}
                  className={`
                    w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer group
                    ${isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{opt.label}</span>
                    {opt.isCustom && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        Custom
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
