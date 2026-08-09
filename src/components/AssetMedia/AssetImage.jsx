import { useState, useRef, useCallback, useEffect } from 'react';
import { 
    Image as ImageIcon, UploadCloud, Camera, X, 
    Trash2, RefreshCw, Download, Maximize2, Loader2, Sparkles
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useToast } from '../../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function AssetImage({ asset, onUpdate }) {
    const { showToast } = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [fullScreen, setFullScreen] = useState(false);
    const [viewUrl, setViewUrl] = useState(null);
    const [thumbUrl, setThumbUrl] = useState(null);

    const fileInputRef = useRef(null);
    const videoRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const loadPrivateImageUrls = async () => {
            if (!asset?.imageUrl) {
                setViewUrl(null);
                setThumbUrl(null);
                return;
            }

            try {
                const token = localStorage.getItem('token');
                const types = asset.thumbnailUrl ? ['view', 'thumb'] : ['view'];
                const responses = await Promise.all(types.map((type) => fetch(
                    `${API_URL}/uploads/image/${asset.id}/${type}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                )));
                if (responses.some((response) => !response.ok)) {
                    throw new Error('Failed to load private image');
                }
                const links = await Promise.all(responses.map((response) => response.json()));
                if (!cancelled) {
                    setViewUrl(links[0].url);
                    setThumbUrl(links[1]?.url || links[0].url);
                }
            } catch (error) {
                if (!cancelled) {
                    setViewUrl(null);
                    setThumbUrl(null);
                }
                console.error(error);
            }
        };

        loadPrivateImageUrls();
        return () => { cancelled = true; };
    }, [asset?.id, asset?.imageUrl, asset?.thumbnailUrl, asset?.imageUploadedAt]);

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const processAndUpload = async (file) => {
        setUploading(true);
        try {
            // High-quality options for main image (Up to 2560px 2K/4K detail, max 2MB, quality 0.88)
            const mainOptions = {
                maxSizeMB: 2.0, // 2MB target max
                maxWidthOrHeight: 2560,
                useWebWorker: true,
                fileType: 'image/webp',
                initialQuality: 0.88
            };

            // High-detail thumbnail options (Max 400px, 150KB max, quality 0.75)
            const thumbOptions = {
                maxSizeMB: 0.15, // 150KB max
                maxWidthOrHeight: 400,
                useWebWorker: true,
                fileType: 'image/webp',
                initialQuality: 0.75
            };

            const compressedMain = await imageCompression(file, mainOptions);
            const compressedThumb = await imageCompression(file, thumbOptions);

            const formData = new FormData();
            formData.append('image', new File([compressedMain], 'image.webp', { type: 'image/webp' }));
            formData.append('thumbnail', new File([compressedThumb], 'thumb.webp', { type: 'image/webp' }));

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/uploads/image/${asset.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to upload image');
            }

            showToast('High-quality asset image uploaded successfully', 'success');
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                return showToast('Only JPG, PNG and WEBP image files are allowed', 'error');
            }
            processAndUpload(file);
        }
    };

    const onDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                return showToast('Only JPG, PNG and WEBP image files are allowed', 'error');
            }
            processAndUpload(file);
        }
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                } 
            });
            setCameraStream(stream);
            setShowCamera(true);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            showToast('Unable to access camera', 'error');
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 1920;
        canvas.height = videoRef.current.videoHeight || 1080;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        
        canvas.toBlob((blob) => {
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            stopCamera();
            processAndUpload(file);
        }, 'image/jpeg', 0.95);
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/image/${asset.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to delete image');
            showToast('Asset image removed securely', 'success');
            setShowDeleteConfirm(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleDownload = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/image/${asset.id}/download`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to get secure download link');
            const data = await res.json();
            
            const a = document.createElement('a');
            a.href = data.url;
            a.download = asset.imageFileName || `asset_${asset.assetCode}.webp`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const hasImage = !!asset?.imageUrl;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                    Asset Image
                </h3>
                {hasImage && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                        Attached
                    </span>
                )}
            </div>

            {hasImage ? (
                <div className="flex flex-col flex-1">
                    {/* Bounded Preview Container with High-Res Zoom */}
                    <div className="relative group rounded-xl overflow-hidden bg-slate-900/5 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-700/80 h-44 sm:h-48 w-full flex items-center justify-center p-2">
                        {thumbUrl ? (
                            <img 
                                src={thumbUrl} 
                                alt={asset.assetCode} 
                                className="max-h-full max-w-full object-contain rounded-lg" 
                            />
                        ) : (
                            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                        )}
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 rounded-xl">
                            <button 
                                onClick={() => setFullScreen(true)} 
                                title="View Full High-Resolution Image"
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm transition flex items-center gap-1.5 text-xs"
                            >
                                <Maximize2 className="w-4 h-4" /> Full View
                            </button>
                            <button 
                                onClick={handleDownload} 
                                title="Download Image"
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm transition flex items-center gap-1.5 text-xs"
                            >
                                <Download className="w-4 h-4" /> Download
                            </button>
                        </div>
                    </div>
                    
                    {/* Compact Metadata */}
                    <div className="mt-3 mb-4 space-y-1 bg-slate-50/80 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={asset.imageFileName}>
                            {asset.imageFileName || `${asset.assetCode}_image.webp`}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{formatBytes(asset.imageFileSize)} • High-Res WEBP</span>
                            <span>{asset.imageUploadedAt ? new Date(asset.imageUploadedAt).toLocaleDateString() : 'Uploaded'}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto">
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={uploading}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Replace
                        </button>
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </div>

                    <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2">
                        Supported: JPG, PNG, WEBP • Maximum optimized image size: 2 MB
                    </p>
                </div>
            ) : (
                /* Compact Empty State */
                <div className="flex flex-col flex-1">
                    <div 
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={`flex-1 min-h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 transition-colors text-center ${
                            isDragging 
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' 
                                : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30'
                        }`}
                    >
                        {uploading ? (
                            <div className="flex flex-col items-center gap-2 py-6">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Optimizing &amp; Uploading...</p>
                            </div>
                        ) : (
                            <>
                                <div className="w-10 h-10 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-center mb-2">
                                    <UploadCloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Drag &amp; drop image here</p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-4">High-detail 2K/4K resolution preserved</p>
                                
                                <div className="flex w-full gap-2 mt-auto">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/20"
                                    >
                                        <UploadCloud className="w-3.5 h-3.5" /> Browse Image
                                    </button>
                                    <button 
                                        onClick={startCamera}
                                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                                    >
                                        <Camera className="w-3.5 h-3.5" /> Camera
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2">
                        Supported: JPG, PNG, WEBP • Maximum optimized image size: 2 MB
                    </p>
                </div>
            )}

            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/jpeg,image/png,image/webp" 
                onChange={handleFileChange}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 mx-auto">
                            <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-center text-slate-800 dark:text-white mb-2">Delete Asset Image?</h3>
                        <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">This action cannot be undone. The image will be permanently removed from storage.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition">Cancel</button>
                            <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Screen View Modal */}
            {fullScreen && (
                <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col">
                    <div className="flex justify-between items-center p-4">
                        <span className="text-white text-sm font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-400" /> High-Resolution Inspection
                        </span>
                        <button onClick={() => setFullScreen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                        {viewUrl && <img src={viewUrl} alt="Full Screen Inspection" className="max-w-full max-h-full object-contain" />}
                    </div>
                </div>
            )}

            {/* Camera Capture Modal */}
            {showCamera && (
                <div className="fixed inset-0 bg-black z-[100] flex flex-col">
                    <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
                        <span className="text-white font-medium drop-shadow-md">Capture Asset Photo</span>
                        <button onClick={stopCamera} className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        <video ref={videoRef} autoPlay playsInline className="min-w-full min-h-full object-cover"></video>
                    </div>
                    <div className="h-32 bg-black flex items-center justify-center pb-8 pt-4">
                        <button 
                            onClick={capturePhoto}
                            className="w-16 h-16 rounded-full border-4 border-white/50 flex items-center justify-center hover:border-white transition-all group"
                        >
                            <div className="w-12 h-12 bg-white rounded-full group-hover:scale-95 transition-transform"></div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
