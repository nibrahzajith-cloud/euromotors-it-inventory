import React, { useState, useRef, useCallback } from 'react';
import { 
    Image as ImageIcon, UploadCloud, Camera, X, 
    Trash2, RefreshCw, Download, Maximize2, Loader2 
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

    const fileInputRef = useRef(null);
    const videoRef = useRef(null);

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
            // Options for main image compression (Max 1920px width, webp)
            const mainOptions = {
                maxSizeMB: 0.5, // 500KB strict max
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                fileType: 'image/webp',
                initialQuality: 0.8
            };

            // Options for thumbnail compression (Max 300px width, webp)
            const thumbOptions = {
                maxSizeMB: 0.05, // 50KB max
                maxWidthOrHeight: 300,
                useWebWorker: true,
                fileType: 'image/webp',
                initialQuality: 0.6
            };

            const compressedMain = await imageCompression(file, mainOptions);
            const compressedThumb = await imageCompression(file, thumbOptions);

            const formData = new FormData();
            // Appending as File to maintain filename and webp extension
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

            showToast('Asset image optimized and uploaded successfully', 'success');
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
                return showToast('Only image files are allowed', 'error');
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
                return showToast('Only image files are allowed', 'error');
            }
            processAndUpload(file);
        }
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
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
            
            // Trigger download via anchor
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
    // Append timestamp to bypass browser caching when replaced
    const viewUrl = hasImage ? `${API_URL.replace('/api', '')}${asset.imageUrl}?t=${new Date(asset.imageUploadedAt).getTime()}` : null;
    const thumbUrl = hasImage && asset.thumbnailUrl ? `${API_URL.replace('/api', '')}${asset.thumbnailUrl}?t=${new Date(asset.imageUploadedAt).getTime()}` : viewUrl;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-full">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                Asset Image
            </h3>

            {hasImage ? (
                <div className="flex flex-col flex-1">
                    <div className="relative group rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 aspect-video flex items-center justify-center mb-4">
                        <img 
                            src={thumbUrl} 
                            alt={asset.assetCode} 
                            className="max-h-full max-w-full object-contain"
                            crossOrigin="anonymous"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button onClick={() => setFullScreen(true)} className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition">
                                <Maximize2 className="w-5 h-5" />
                            </button>
                            <button onClick={handleDownload} className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition">
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="space-y-1 mb-6 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={asset.imageFileName}>{asset.imageFileName}</p>
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>{formatBytes(asset.imageFileSize)} • WEBP</span>
                            <span>{new Date(asset.imageUploadedAt).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-auto">
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={uploading}
                            className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Replace
                        </button>
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex-1 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    </div>
                </div>
            ) : (
                <div 
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 transition-colors ${
                        isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
                    }`}
                >
                    {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Optimizing &amp; Uploading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-12 h-12 bg-white dark:bg-slate-800 shadow-sm rounded-full flex items-center justify-center mb-4">
                                <UploadCloud className="w-6 h-6 text-blue-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Drag &amp; drop image here</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 text-center">Auto-compresses to lightweight WEBP</p>
                            
                            <div className="flex w-full gap-2">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20"
                                >
                                    <UploadCloud className="w-4 h-4" /> Browse
                                </button>
                                <button 
                                    onClick={startCamera}
                                    className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center justify-center gap-2"
                                >
                                    <Camera className="w-4 h-4" /> Camera
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
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
                    <div className="flex justify-end p-4">
                        <button onClick={() => setFullScreen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                        <img 
                            src={viewUrl} 
                            alt="Full Screen" 
                            className="max-w-full max-h-full object-contain"
                            crossOrigin="anonymous"
                        />
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
