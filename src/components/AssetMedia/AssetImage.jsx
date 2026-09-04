import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Image as ImageIcon, UploadCloud, Camera, X,
    Trash2, Download, Maximize2, Loader2, Sparkles, AlertCircle, Star
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
    const cameraInputRef = useRef(null);

    const fetchImages = async () => {
        if (!asset?.id) return;
        try {
            setLoadingImages(true);
            const token = localStorage.getItem('token');
            const list = [];

            // 1. Primary Asset Image (stored directly on the Asset record)
            if (asset.imageUrl || asset.imageStorageKey) {
                list.push({
                    id: 'primary',
                    isPrimary: true,
                    documentName: asset.imageFileName || `${asset.assetCode} - Primary Photo`,
                    documentType: 'IMAGE',
                    fileSize: asset.imageFileSize || 0,
                    createdAt: asset.imageUploadedAt || asset.createdAt,
                    storageKey: asset.imageStorageKey,
                    viewEndpoint: `${API_URL}/uploads/image/${asset.id}/view`,
                    thumbEndpoint: `${API_URL}/uploads/image/${asset.id}/thumb`,
                    downloadEndpoint: `${API_URL}/uploads/image/${asset.id}/download`,
                });
            }

            // 2. Additional Asset Gallery / Document Images
            const res = await fetch(`${API_URL}/uploads/documents/${asset.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const docs = await res.json();
                    const imageDocs = docs
                        .filter(d => d.documentType === 'IMAGE')
                        .map(d => ({
                            ...d,
                            isPrimary: false,
                            viewEndpoint: `${API_URL}/uploads/document/${d.id}/view`,
                            thumbEndpoint: `${API_URL}/uploads/document/${d.id}/view`,
                            downloadEndpoint: `${API_URL}/uploads/document/${d.id}/download`,
                        }));
                    list.push(...imageDocs);
                }
            }

            setImages(list);
        } catch (error) {
            console.error("Failed to load images:", error);
        } finally {
            setLoadingImages(false);
        }
    };

    useEffect(() => {
        fetchImages();
    }, [asset?.id, asset?.imageUrl, asset?.imageStorageKey]);

    const processAndUploadBatch = async (filesArray) => {
        if (filesArray.length > 10) {
            return showToast('Maximum 10 images can be uploaded at once', 'error');
        }
        
        setUploading(true);
        setUploadProgress({ current: 0, total: filesArray.length });
        
        try {
            const token = localStorage.getItem('token');
            let completed = 0;
            const hasPrimary = Boolean(asset.imageUrl || asset.imageStorageKey);
            
            // If asset has no primary image, upload first file as primary
            let startIndex = 0;
            if (!hasPrimary && filesArray.length > 0) {
                const firstFile = filesArray[0];
                const options = {
                    maxSizeMB: 1.0,
                    maxWidthOrHeight: 2560,
                    useWebWorker: false,
                    fileType: 'image/webp',
                    initialQuality: 0.88
                };
                const compressed = await imageCompression(firstFile, options);
                const fileName = firstFile.name || `asset_${asset.assetCode}.webp`;

                const formData = new FormData();
                formData.append('image', new File([compressed], fileName, { type: 'image/webp' }));

                try {
                    const thumbCompressed = await imageCompression(compressed, {
                        maxSizeMB: 0.1,
                        maxWidthOrHeight: 300,
                        useWebWorker: false,
                        fileType: 'image/webp'
                    });
                    formData.append('thumbnail', new File([thumbCompressed], `thumb_${fileName}`, { type: 'image/webp' }));
                } catch (_) {}

                const uploadRes = await fetch(`${API_URL}/uploads/image/${asset.id}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (!uploadRes.ok) {
                    const err = await uploadRes.json().catch(() => ({}));
                    throw new Error(err.error || 'Failed to upload primary asset image');
                }

                completed++;
                setUploadProgress({ current: completed, total: filesArray.length });
                startIndex = 1;
            }

            // Upload remaining files to gallery
            const remainingFiles = filesArray.slice(startIndex);
            if (remainingFiles.length > 0) {
                // Try batch gallery endpoint first
                const galleryFormData = new FormData();
                for (let i = 0; i < remainingFiles.length; i++) {
                    const file = remainingFiles[i];
                    const options = {
                        maxSizeMB: 1.0,
                        maxWidthOrHeight: 2560,
                        useWebWorker: false,
                        fileType: 'image/webp',
                        initialQuality: 0.88
                    };
                    const compressed = await imageCompression(file, options);
                    const fileName = file.name || `gallery_${Date.now()}_${i}.webp`;
                    galleryFormData.append('images', new File([compressed], fileName, { type: 'image/webp' }));
                }

                const galleryRes = await fetch(`${API_URL}/uploads/gallery/${asset.id}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: galleryFormData
                });

                if (!galleryRes.ok) {
                    // Fallback to uploading individually via document endpoint
                    for (const file of remainingFiles) {
                        const options = {
                            maxSizeMB: 1.0,
                            maxWidthOrHeight: 2560,
                            useWebWorker: false,
                            fileType: 'image/webp',
                            initialQuality: 0.88
                        };
                        const compressed = await imageCompression(file, options);
                        const fileName = file.name || `photo_${Date.now()}.webp`;
                        const docFormData = new FormData();
                        docFormData.append('document', new File([compressed], fileName, { type: 'image/webp' }));
                        docFormData.append('documentType', 'IMAGE');

                        await fetch(`${API_URL}/uploads/document/${asset.id}`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: docFormData
                        });
                        completed++;
                        setUploadProgress({ current: completed, total: filesArray.length });
                    }
                } else {
                    completed += remainingFiles.length;
                    setUploadProgress({ current: completed, total: filesArray.length });
                }
            }

            showToast(`${filesArray.length} image(s) uploaded successfully`, 'success');
            if (onUpdate) await onUpdate();
            await fetchImages();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
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

    const handleDelete = async (doc) => {
        if (!window.confirm(`Delete ${doc.isPrimary ? 'primary asset photo' : 'this photo'}?`)) return;
        setDeletingId(doc.id);
        try {
            const token = localStorage.getItem('token');
            const deleteUrl = doc.isPrimary
                ? `${API_URL}/uploads/image/${asset.id}`
                : `${API_URL}/uploads/document/${doc.id}`;
            const res = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to delete image');
            showToast('Image deleted successfully', 'success');
            if (onUpdate) await onUpdate();
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
            const endpoint = doc.viewEndpoint || (doc.isPrimary
                ? `${API_URL}/uploads/image/${asset.id}/view`
                : `${API_URL}/uploads/document/${doc.id}/view`);
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                let errorMessage = 'Failed to get view link';
                if (response.headers.get('content-type')?.includes('application/json')) {
                    const err = await response.json();
                    errorMessage = err.error || errorMessage;
                }
                throw new Error(errorMessage);
            }
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
            const endpoint = doc.downloadEndpoint || (doc.isPrimary
                ? `${API_URL}/uploads/image/${asset.id}/download`
                : `${API_URL}/uploads/document/${doc.id}/download`);
            const res = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                let errorMessage = 'Failed to get secure download link';
                if (res.headers.get('content-type')?.includes('application/json')) {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                }
                throw new Error(errorMessage);
            }
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
                                    
                                    {img.isPrimary && (
                                        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-sm flex items-center gap-1 pointer-events-none">
                                            <Star className="w-2.5 h-2.5 fill-current" /> Primary
                                        </span>
                                    )}

                                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 z-20">
                                        <div className="flex justify-end">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                                                disabled={deletingId === img.id}
                                                className="p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg shadow-sm transition"
                                                title={img.isPrimary ? "Delete Primary Photo" : "Delete Photo"}
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
                            <div className="w-full flex flex-col gap-2">
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 cursor-pointer"
                                    >
                                        <UploadCloud className="w-4 h-4" /> Select Images
                                    </button>
                                    <button
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                    >
                                        <Camera className="w-4 h-4" /> Camera
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Drag & drop up to 10 images. JPG, PNG, WEBP.
                                </p>
                            </div>
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
            <input
                type="file"
                ref={cameraInputRef}
                className="hidden"
                accept="image/*"
                capture="environment"
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
                        <button onClick={() => setFullScreen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition cursor-pointer">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                        {viewUrl && <img src={viewUrl} alt="Full Screen Inspection" className="max-w-full max-h-full object-contain rounded-lg" />}
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
                const endpoint = doc.thumbEndpoint || doc.viewEndpoint;
                const res = await fetch(endpoint, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to load');
                if (res.headers.get('content-type')?.includes('application/json')) {
                    const data = await res.json();
                    if (!cancelled) setThumbUrl(data.url);
                } else {
                    throw new Error('Invalid format');
                }
            } catch (err) {
                if (!cancelled) setError(true);
            }
        };
        fetchUrl();
        return () => { cancelled = true; };
    }, [doc.id, doc.thumbEndpoint, doc.viewEndpoint]);

    if (error) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-pointer p-2 text-center" onClick={onClick}>
                <AlertCircle className="w-6 h-6 opacity-50 mb-1" />
                <span className="text-[9px] text-slate-400">Failed to load</span>
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
            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200" 
            onClick={onClick}
        />
    );
}
