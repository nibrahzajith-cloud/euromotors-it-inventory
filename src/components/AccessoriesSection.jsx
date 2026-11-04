import { useState, useEffect } from 'react';
import { Plus, Check, Trash2, Tag, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { STANDARD_ACCESSORIES } from '../constants/assetOptions';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function AccessoriesSection({
  accessories = [],
  onChange,
  disabled = false,
  readOnly = false,
  title = "Accessories & Other Assets",
  description = "Record accessories and hardware components issued with this asset."
}) {
  const [availableOptions, setAvailableOptions] = useState(STANDARD_ACCESSORIES);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newAccessoryName, setNewAccessoryName] = useState('');
  const [addingError, setAddingError] = useState('');
  const [otherText, setOtherText] = useState('');
  const [expandedDetails, setExpandedDetails] = useState({});

  // Normalize incoming accessories (could be strings or objects)
  const normalizedSelected = (Array.isArray(accessories) ? accessories : []).map(item => {
    if (typeof item === 'string') {
      return { name: item, selected: true, serialNumber: '', notes: '' };
    }
    return {
      name: item.name || '',
      selected: item.selected !== false,
      serialNumber: item.serialNumber || '',
      notes: item.notes || ''
    };
  });

  // Fetch custom accessory options from DB
  useEffect(() => {
    let isMounted = true;
    const fetchCustomAccessories = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/dropdown-options/accessories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const customList = await res.json();
          if (Array.isArray(customList) && isMounted) {
            setAvailableOptions(prev => {
              const combined = [...STANDARD_ACCESSORIES];
              customList.forEach(opt => {
                if (typeof opt === 'string' && opt.trim() && !combined.some(c => c.toLowerCase() === opt.toLowerCase())) {
                  combined.splice(combined.length - 1, 0, opt.trim());
                }
              });
              return combined;
            });
          }
        }
      } catch (_) {}
    };
    fetchCustomAccessories();
    return () => { isMounted = false; };
  }, []);

  // Ensure any pre-selected accessory exists in available options
  useEffect(() => {
    normalizedSelected.forEach(sel => {
      if (sel.name && !availableOptions.some(opt => opt.toLowerCase() === sel.name.toLowerCase())) {
        setAvailableOptions(prev => {
          const copy = [...prev];
          copy.splice(copy.length - 1, 0, sel.name);
          return copy;
        });
      }
    });
  }, [accessories]);

  const isChecked = (name) => {
    if (name === 'Other') {
      return normalizedSelected.some(a => a.name === 'Other' || a.name.startsWith('Other:'));
    }
    return normalizedSelected.some(a => a.name.toLowerCase() === name.toLowerCase());
  };

  const getAccessoryItem = (name) => {
    if (name === 'Other') {
      return normalizedSelected.find(a => a.name === 'Other' || a.name.startsWith('Other:'));
    }
    return normalizedSelected.find(a => a.name.toLowerCase() === name.toLowerCase());
  };

  const handleToggle = (name) => {
    if (disabled || readOnly) return;
    const checked = isChecked(name);
    let nextList;

    if (checked) {
      if (name === 'Other') {
        nextList = normalizedSelected.filter(a => a.name !== 'Other' && !a.name.startsWith('Other:'));
        setOtherText('');
      } else {
        nextList = normalizedSelected.filter(a => a.name.toLowerCase() !== name.toLowerCase());
      }
    } else {
      if (name === 'Other') {
        nextList = [...normalizedSelected, { name: otherText ? `Other: ${otherText}` : 'Other', selected: true, serialNumber: '', notes: '' }];
      } else {
        nextList = [...normalizedSelected, { name, selected: true, serialNumber: '', notes: '' }];
      }
    }

    onChange(nextList);
  };

  const handleUpdateItemDetails = (name, key, val) => {
    if (disabled || readOnly) return;
    const nextList = normalizedSelected.map(item => {
      const match = (name === 'Other') 
        ? (item.name === 'Other' || item.name.startsWith('Other:')) 
        : (item.name.toLowerCase() === name.toLowerCase());
      if (match) {
        return { ...item, [key]: val };
      }
      return item;
    });
    onChange(nextList);
  };

  const handleOtherTextChange = (text) => {
    setOtherText(text);
    const existingOther = normalizedSelected.find(a => a.name === 'Other' || a.name.startsWith('Other:'));
    const finalName = text.trim() ? `Other: ${text.trim()}` : 'Other';

    if (existingOther) {
      const nextList = normalizedSelected.map(a => {
        if (a === existingOther) return { ...a, name: finalName };
        return a;
      });
      onChange(nextList);
    } else {
      onChange([...normalizedSelected, { name: finalName, selected: true, serialNumber: '', notes: '' }]);
    }
  };

  const handleSaveNewAccessory = async () => {
    const trimmed = newAccessoryName.trim();
    if (!trimmed) {
      setAddingError('Accessory name is required');
      return;
    }

    if (availableOptions.some(opt => opt.toLowerCase() === trimmed.toLowerCase())) {
      setAddingError('This accessory option already exists');
      return;
    }

    setAddingError('');

    // Add to available options and auto-select
    setAvailableOptions(prev => {
      const copy = [...prev];
      copy.splice(copy.length - 1, 0, trimmed);
      return copy;
    });

    const nextSelected = [...normalizedSelected, { name: trimmed, selected: true, serialNumber: '', notes: '' }];
    onChange(nextSelected);

    // Persist permanently in DB via /api/dropdown-options/accessories
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/dropdown-options/accessories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: trimmed })
      });
    } catch (_) {}

    setNewAccessoryName('');
    setIsAddingNew(false);
  };

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>

        {!readOnly && !disabled && (
          <button
            type="button"
            onClick={() => {
              setIsAddingNew(!isAddingNew);
              setAddingError('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add New Accessory</span>
          </button>
        )}
      </div>

      {/* Dynamic Add New Accessory Form */}
      {isAddingNew && (
        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-150">
          <label className="block text-xs font-semibold text-blue-900 dark:text-blue-300">
            Create Custom Accessory Type
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              autoFocus
              value={newAccessoryName}
              onChange={(e) => {
                setNewAccessoryName(e.target.value);
                setAddingError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveNewAccessory();
                }
              }}
              placeholder="e.g. USB-C Converter, Privacy Screen, Stylus Pen..."
              className="flex-1 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700/80 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveNewAccessory}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                Save Accessory
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(false);
                  setNewAccessoryName('');
                  setAddingError('');
                }}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
          {addingError && (
            <p className="text-xs text-red-500 dark:text-red-400 font-medium">{addingError}</p>
          )}
        </div>
      )}

      {/* Accessories Checkbox Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {availableOptions.map((opt) => {
          const checked = isChecked(opt);
          const item = getAccessoryItem(opt);
          const hasDetailsOpen = expandedDetails[opt];

          return (
            <div
              key={opt}
              className={`rounded-xl border transition-all ${
                checked
                  ? 'bg-blue-50/40 dark:bg-blue-900/15 border-blue-400 dark:border-blue-500/50 shadow-sm'
                  : 'bg-slate-50/50 dark:bg-[#070b13]/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                onClick={() => handleToggle(opt)}
                className={`flex items-center justify-between p-3 select-none ${
                  disabled || readOnly ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                      checked
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className={`text-xs font-medium truncate ${
                    checked ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {opt}
                  </span>
                </div>

                {checked && (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setExpandedDetails(prev => ({ ...prev, [opt]: !prev[opt] }))}
                      title="Add serial number or independent tracking"
                      className="p-1 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Other Custom Input Field */}
              {opt === 'Other' && checked && (
                <div className="px-3 pb-3 pt-0 border-t border-blue-200/40 dark:border-blue-800/40 mt-1">
                  <input
                    type="text"
                    disabled={disabled || readOnly}
                    value={otherText || (item?.name?.startsWith('Other: ') ? item.name.replace('Other: ', '') : '')}
                    onChange={(e) => handleOtherTextChange(e.target.value)}
                    placeholder="Specify other accessory..."
                    className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Independent Tracking / Serial / Notes Sub-panel */}
              {checked && hasDetailsOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-blue-200/40 dark:border-blue-800/40 mt-1 space-y-2 animate-in fade-in duration-100">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                      Serial Number / Asset Tag
                    </label>
                    <input
                      type="text"
                      disabled={disabled || readOnly}
                      value={item?.serialNumber || ''}
                      onChange={(e) => handleUpdateItemDetails(opt, 'serialNumber', e.target.value)}
                      placeholder="Optional serial #..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                      Notes
                    </label>
                    <input
                      type="text"
                      disabled={disabled || readOnly}
                      value={item?.notes || ''}
                      onChange={(e) => handleUpdateItemDetails(opt, 'notes', e.target.value)}
                      placeholder="e.g. 65W Type-C original"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Summary Pill Bar */}
      {normalizedSelected.length > 0 && (
        <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Linked ({normalizedSelected.length}):
          </span>
          {normalizedSelected.map((acc, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
            >
              <span>{acc.name}</span>
              {acc.serialNumber && (
                <span className="font-mono text-[10px] text-blue-500 dark:text-blue-400">({acc.serialNumber})</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

