import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { Camera, AlertCircle } from 'lucide-react';

export default function Scanner() {
  const [scanResult, setScanResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        setScanResult(decodedText);
        scanner.clear();
        // Delay slightly for UX
        setTimeout(() => {
          navigate(`/assets/${encodeURIComponent(decodedText.trim())}`);
        }, 1000);
      },
      (error) => {
        // Suppress continuous errors when no code is found
      }
    );

    return () => {
      scanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, [navigate]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center justify-center gap-2">
          <Camera className="w-6 h-6 text-blue-600" />
          Hardware Scanner
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Scan a physical asset tag to instantly open its profile.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 overflow-hidden">
        {scanResult ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Scan Successful</h2>
            <p className="text-slate-600 dark:text-slate-400">Redirecting to Asset {scanResult}...</p>
          </div>
        ) : (
          <div id="reader" className="w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"></div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300">How to use</h3>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Allow camera permissions when prompted by your browser. Hold your device steady and center the QR code inside the scanning box.</p>
        </div>
      </div>
    </div>
  );
}
