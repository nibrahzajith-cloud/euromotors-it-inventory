import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Image as ImageIcon, UploadCloud, Camera, X,
    Trash2, RefreshCw, Download, Maximize2, Loader2, Sparkles, AlertCircle
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useToast } from '../../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function AssetImage({ asset, onUpdate }) {
    const { showToast } = useToast();
    const [images, setImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(true);
    
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    
    const [fullScreen, setFullScreen] = useState(false);
    const [viewUrl, setViewUrl] = useState(null);
    const [viewImageName, setViewImageName] = useState(null);
    
    const [deletingId, setDeletingId] = useState(null);

    const fileInputRef = useRef(null);

    const fetchImages = async () => {
        try {
            setLoadingImages(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/documents/${asset.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const docs = await res.json();
                const imageDocs = docs.filter(d => d.documentType === 'IMAGE');
                setImages(imageDocs);
            }
        } catch (error) {
            console.error("Failed to load images:", error);
        } finally {
            setLoadingImages(false);
        }
    };

    useEffect(() => {
        fetchImages();
    }, [asset?.id]);

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const processAndUploadBatch = async (filesArray) => {
        if (filesArray.length > 10) {
            return showToast('Maximum 10 images can be uploaded at once', 'error');
        }
        
        setUploading(true);
        setUploadProgress({ current: 0, total: filesArray.length });
        
        try {
            const formData = new FormData();
            
            for (let i = 0; i < filesArray.length; i++) {
                const file = filesArray[i];
                const options = {
                    maxSizeMB: 1.0,
                    maxWidthOrHeight: 2560,
                    useWebWorker: true,
                    fileType: 'image/webp',
                    initialQuality: 0.88
                };
                
                setUploadProgress({ current: i + 1, total: filesArray.length });
                const compressed = await imageCompression(file, options);
                formData.append('images', new File([compressed], file.name, { type: 'image/webp' }));
            }

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/uploads/gallery/${asset.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to upload images');
            }

            showToast(`${filesArray.length} image(s) uploaded successfully`, 'success');
            await fetchImages();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        const validFiles = files.filter(f => f.type.startsWith('image/'));
        
        if (validFiles.length !== files.length) {
            showToast('Only JPG, PNG and WEBP image files are allowed', 'warning');
        }
        
        if (validFiles.length > 0) {
            processAndUploadBatch(validFiles);
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
        const files = Array.from(e.dataTransfer.files || []);
        const validFiles = files.filter(f => f.type.startsWith('image/'));
        
        if (validFiles.length > 0) {
            processAndUploadBatch(validFiles);
        }
    }, []);

    const handleDelete = async (docId) => {
        if (!window.confirm("Delete this image?")) return;
        setDeletingId(docId);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/document/${docId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to delete image');
            showToast('Image deleted successfully', 'success');
            await fetchImages();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const openPreview = async (doc) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/uploads/document/${doc.id}/view`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to get view link');
            const data = await response.json();
            setViewUrl(data.url);
            setViewImageName(doc.documentName);
            setFullScreen(true);
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const handleDownload = async (doc) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/document/${doc.id}/download`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to get secure download link');
            const data = await res.json();

            const a = document.createElement('a');
            a.href = data.url;
            a.download = doc.documentName || `asset_${asset.assetCode}.webp`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-full min-h-[400px]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                    <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Asset Images
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {images.length} {images.length === 1 ? 'Image' : 'Images'}
                </span>
            </div>

            {loadingImages ? (
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="flex flex-col flex-1">
                    {images.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 overflow-y-auto max-h-[300px] pr-2">
                            {images.map(img => (
                                <div key={img.id} className="relative group rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 aspect-square border border-slate-200 dark:border-slate-700">
                                    <ImageThumbnail doc={img} onClick={() => openPreview(img)} />
                                    
                                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                        <div className="flex justify-end">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                                                disabled={deletingId === img.id}
                                                className="p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg shadow-sm transition"
                                                title="Delete"
                                            >
                                                {deletingId === img.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openPreview(img); }}
                                                className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition"
                                                title="View"
                                            >
                                                <Maximize2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDownload(img); }}
                                                className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition"
                                                title="Download"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center mb-3">
                                <ImageIcon className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No images attached</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Upload front, back, condition, or location photos for this asset.</p>
                        </div>
                    )}

                    <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={`mt-auto border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 transition-colors text-center ${isDragging
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                                : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30'
                            }`}
                    >
                        {uploading ? (
                            <div className="flex flex-col items-center gap-2 py-4">
                                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    {uploadProgress ? `Processing & Uploading ${uploadProgress.current} of ${uploadProgress.total}...` : 'Uploading...'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20"
                                >
                                    <UploadCloud className="w-4 h-4" /> Select Images
                                </button>
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Drag & drop up to 10 images. JPG, PNG, WEBP.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            <input
                type="file"
                multiple
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
            />

            {fullScreen && (
                <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col">
                    <div className="flex justify-between items-center p-4">
                        <div className="flex flex-col">
                            <span className="text-white text-sm font-semibold flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-blue-400" /> High-Resolution Inspection
                            </span>
                            <span className="text-slate-400 text-xs ml-6">{viewImageName}</span>
                        </div>
                        <button onClick={() => setFullScreen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                        {viewUrl && <img src={viewUrl} alt="Full Screen Inspection" className="max-w-full max-h-full object-contain" />}
                    </div>
                </div>
            )}
        </div>
    );
}

function ImageThumbnail({ doc, onClick }) {
    const [thumbUrl, setThumbUrl] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const fetchUrl = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/uploads/document/${doc.id}/view`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to load');
                const data = await res.json();
                if (!cancelled) setThumbUrl(data.url);
            } catch (err) {
                if (!cancelled) setError(true);
            }
        };
        fetchUrl();
        return () => { cancelled = true; };
    }, [doc.id]);

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400" onClick={onClick}>
                <AlertCircle className="w-6 h-6 opacity-50" />
            </div>
        );
    }

    if (!thumbUrl) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800/50" onClick={onClick}>
                <Loader2 className="w-5 h-5 animate-spin text-blue-500/50" />
            </div>
        );
    }

    return (
        <img 
            src={thumbUrl} 
            alt={doc.documentName} 
            className="w-full h-full object-cover cursor-pointer" 
            onClick={onClick}
        />
    );
}
