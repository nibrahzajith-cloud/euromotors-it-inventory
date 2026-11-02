import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export async function copyToClipboard(text, label = '', showToast = null) {
  if (!text) return false;
  const cleanText = String(text).trim();

  let success = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(cleanText);
      success = true;
    } catch (_) {
      success = false;
    }
  }

  if (!success) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = cleanText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (_) {
      success = false;
    }
  }

  if (success && showToast) {
    showToast(`Copied ${label ? `${label}: ` : ''}${cleanText}`, 'success');
  } else if (!success && showToast) {
    showToast('Failed to copy text', 'error');
  }

  return success;
}

export default function CopyButton({ 
  text, 
  label = '', 
  className = '', 
  title = '',
  iconSize = 'w-3.5 h-3.5',
  showNotification = true
}) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast() || {};

  const handleCopy = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyToClipboard(text, label, showNotification ? showToast : null);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  if (!text) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title || `Copy ${label ? `${label}: ` : ''}${text}`}
      aria-label={`Copy ${label || text}`}
      className={`inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group shrink-0 ${className}`}
    >
      {copied ? (
        <Check className={`${iconSize} text-emerald-500 animate-in zoom-in-50 duration-150`} />
      ) : (
        <Copy className={`${iconSize} opacity-70 group-hover:opacity-100 transition-opacity`} />
      )}
    </button>
  );
}
