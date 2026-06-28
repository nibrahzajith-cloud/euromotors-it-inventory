import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    type: 'confirm', // 'confirm' or 'prompt'
    title: '',
    message: '',
    inputValue: '',
    inputPlaceholder: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
    onCancel: null
  });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        type: options.type || 'confirm',
        title: options.title || 'Are you sure?',
        message: options.message || '',
        inputValue: options.defaultValue || '',
        inputPlaceholder: options.inputPlaceholder || '',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        onConfirm: (val) => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve(options.type === 'prompt' ? val : true);
        },
        onCancel: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve(options.type === 'prompt' ? null : false);
        }
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3 text-slate-800 font-bold">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                {confirmState.title}
              </div>
              <button onClick={confirmState.onCancel} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {confirmState.message && <p className="text-slate-600 text-sm leading-relaxed">{confirmState.message}</p>}
              
              {confirmState.type === 'prompt' && (
                <input 
                  type="text" 
                  value={confirmState.inputValue}
                  onChange={(e) => setConfirmState(prev => ({ ...prev, inputValue: e.target.value }))}
                  placeholder={confirmState.inputPlaceholder}
                  autoFocus
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmState.onConfirm(confirmState.inputValue);
                  }}
                />
              )}
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={confirmState.onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                {confirmState.cancelText}
              </button>
              <button 
                onClick={() => confirmState.onConfirm(confirmState.inputValue)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors shadow-sm ${confirmState.type === 'prompt' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'}`}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};
