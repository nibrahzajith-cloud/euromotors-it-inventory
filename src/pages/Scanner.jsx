import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { Camera, AlertCircle, SwitchCamera, Loader2, CheckCircle2 } from 'lucide-react';

export default function Scanner() {
  const [scanResult, setScanResult] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;
    let isMounted = true;

    const startScanner = async () => {
      setIsInitializing(true);
      setError(null);
      try {
        await html5QrCode.start(
          { facingMode: facingMode },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (isMounted) {
              setScanResult(decodedText);
              html5QrCode.stop().catch(console.error);
              setTimeout(() => {
                navigate(`/assets/${encodeURIComponent(decodedText.trim())}`);
              }, 1000);
            }
          },
          () => {} // Suppress continuous errors when no code is found
        );
      } catch (err) {
        if (isMounted) {
          console.error("Scanner failed:", err);
          setError("Failed to access camera. Please ensure permissions are granted.");
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [navigate, facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-3">
          <Camera className="w-8 h-8 text-blue-600" />
          Asset Scanner
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
          Scan an asset tag to instantly open its profile.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 overflow-hidden relative">
        {scanResult ? (
          <div className="text-center py-12 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Scan Successful</h2>
            <p className="text-slate-500 dark:text-slate-400">Redirecting to Asset <span className="font-semibold text-slate-700 dark:text-slate-300">{scanResult}</span>...</p>
          </div>
        ) : (
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 aspect-square sm:aspect-video flex items-center justify-center group">
              {isInitializing && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Initializing camera...</p>
                </div>
              )}
              
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-50 dark:bg-slate-900">
                  <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm font-medium"
                  >
                    Refresh Page
                  </button>
                </div>
              )}

              {/* The actual scanner container */}
              <div id="reader" className="w-full h-full object-cover"></div>

              {/* Professional Overlay Camera Switch Button */}
              {!error && (
                <button
                  onClick={toggleCamera}
                  disabled={isInitializing}
                  title="Switch Camera"
                  className="absolute bottom-4 right-4 z-20 flex items-center justify-center w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full shadow-lg border border-white/20 transition-all active:scale-90 disabled:opacity-0 disabled:cursor-not-allowed group-hover:opacity-100 sm:opacity-100"
                >
                  <SwitchCamera className="w-5 h-5 transition-transform group-hover:rotate-180 duration-500" />
                </button>
              )}
            </div>
            
            <div className="mt-6 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium shadow-sm border border-blue-100 dark:border-blue-800/50">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
                Scanning Automatically
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex gap-3 text-slate-600 dark:text-slate-400">
        <AlertCircle className="w-5 h-5 shrink-0 text-slate-400" />
        <div className="text-sm">
          <p>Hold your device steady and center the QR code inside the scanning box. The system will automatically detect and scan it.</p>
        </div>
      </div>
    </div>
  );
}
