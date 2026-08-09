import { useState, useRef, useCallback, useEffect } from 'react';
import { 
    FileText, UploadCloud, Trash2, RefreshCw, 
    Download, ExternalLink, Loader2, FilePlus
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import imageCompression from 'browser-image-compression';
import { useToast } from '../../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function AssetDocuments({ asset, onUpdate }) {
    const { showToast } = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [docType, setDocType] = useState('Purchase / Proforma Invoice');
    const [documents, setDocuments] = useState([]);

    const fileInputRef = useRef(null);

    // Fetch existing documents on mount
    useEffect(() => {
        let cancelled = false;
        const fetchDocs = async () => {
            if (!asset?.id) return;
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/uploads/documents/${asset.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (!cancelled) setDocuments(data);
                }
            } catch (e) {
                console.error("Failed to fetch documents", e);
            }
        };
        fetchDocs();
        return () => { cancelled = true; };
    }, [asset?.id]);

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const processFiles = async (filesArray) => {
        if (filesArray.length === 0) return;
        setUploading(true);

        try {
            // Create a new PDF Document
            const pdfDoc = await PDFDocument.create();

            for (const file of filesArray) {
                if (file.type === 'application/pdf') {
                    // Embed existing PDF pages
                    const arrayBuffer = await file.arrayBuffer();
                    const importedPdf = await PDFDocument.load(arrayBuffer);
                    const copiedPages = await pdfDoc.copyPages(importedPdf, importedPdf.getPageIndices());
                    copiedPages.forEach((page) => pdfDoc.addPage(page));
                } else if (file.type.startsWith('image/')) {
                    // Compress image before embedding to save space
                    const compressedImg = await imageCompression(file, {
                        maxSizeMB: 0.8,
                        maxWidthOrHeight: 1200,
                        useWebWorker: true,
                        fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg'
                    });
                    const imgBuffer = await compressedImg.arrayBuffer();
                    
                    let pdfImage;
                    if (compressedImg.type === 'image/png') {
                        pdfImage = await pdfDoc.embedPng(imgBuffer);
                    } else {
                        pdfImage = await pdfDoc.embedJpg(imgBuffer);
                    }

                    // Standard A4 page size
                    const page = pdfDoc.addPage([595.28, 841.89]);
                    const { width, height } = pdfImage.scaleToFit(595.28 - 40, 841.89 - 40);
                    
                    page.drawImage(pdfImage, {
                        x: 595.28 / 2 - width / 2,
                        y: 841.89 / 2 - height / 2,
                        width,
                        height,
                    });
                }
            }

            // Save PDF with no extra metadata to optimize size
            const pdfBytes = await pdfDoc.save();
            const mergedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            // Check size (Max 5MB)
            if (mergedBlob.size > 5 * 1024 * 1024) {
                throw new Error('Merged PDF exceeds the 5MB maximum limit. Please compress source files before uploading.');
            }

            const formData = new FormData();
            formData.append('document', new File([mergedBlob], `${asset.assetCode}_document.pdf`, { type: 'application/pdf' }));
            formData.append('documentType', docType);

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/document/${asset.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to upload document');
            }

            const newDoc = await res.json();
            setDocuments([newDoc]);

            showToast('Document securely optimized and uploaded', 'success');
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
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            processFiles(files);
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
        const files = Array.from(e.dataTransfer.files);
        const validFiles = files.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
        
        if (validFiles.length !== files.length) {
            showToast('Only PDFs and Images are supported', 'warning');
        }

        if (validFiles.length > 0) {
            processFiles(validFiles);
        }
    }, [docType]);

    const handleDelete = async () => {
        if (documents.length === 0) return;
        setDeleting(true);
        try {
            const docId = documents[0].id;
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/document/${docId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to delete document');
            
            showToast('Document permanently removed', 'success');
            setDocuments([]);
            setShowDeleteConfirm(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleDownload = async (action) => {
        if (documents.length === 0) return;
        try {
            const doc = documents[0];
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/document/${doc.id}/${action}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to generate secure link');
            
            if (action === 'download') {
                const data = await res.json();
                const a = document.createElement('a');
                a.href = data.url;
                a.download = doc.documentName || `asset_${asset.assetCode}_document.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                const data = await res.json();
                window.open(data.url, '_blank');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleViewSecure = async () => {
        if (documents.length === 0) return;
        try {
            const docId = documents[0].id;
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/document/${docId}/download`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to retrieve view link');
            const data = await res.json();
            window.open(data.url, '_blank');
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const hasDocument = documents.length > 0;
    const currentDoc = hasDocument ? documents[0] : null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                    Asset Documents
                </h3>
                {hasDocument && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                        PDF Attached
                    </span>
                )}
            </div>

            {hasDocument ? (
                <div className="flex flex-col flex-1">
                    {/* Compact Document Info Card */}
                    <div className="h-44 sm:h-48 w-full p-3.5 bg-slate-50/80 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100/80 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200/50 dark:border-red-800/30">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={currentDoc.documentName}>
                                    {currentDoc.documentName}
                                </p>
                                <span className="inline-block px-2 py-0.5 bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold rounded-md mt-1">
                                    {currentDoc.documentType || 'Purchase Invoice'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1 bg-white/70 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/50 text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex items-center justify-between">
                                <span>Size: <strong className="text-slate-700 dark:text-slate-300 font-medium">{formatBytes(currentDoc.fileSize)}</strong></span>
                                <span>Date: <strong className="text-slate-700 dark:text-slate-300 font-medium">{new Date(currentDoc.createdAt).toLocaleDateString()}</strong></span>
                            </div>
                            {currentDoc.uploadedByName && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">By: {currentDoc.uploadedByName}</p>
                            )}
                        </div>
                    </div>

                    {/* Actions directly below document info */}
                    <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
                        <button 
                            onClick={handleViewSecure} 
                            className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> View PDF
                        </button>
                        <button 
                            onClick={() => handleDownload('download')} 
                            className="py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                        >
                            <Download className="w-3.5 h-3.5" /> Download
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={uploading}
                            className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Replace
                        </button>
                        <button 
                            onClick={() => setShowDeleteConfirm(true)} 
                            className="py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </div>
                </div>
            ) : (
                /* Compact Empty State */
                <div 
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`flex-1 min-h-[220px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 transition-colors text-center ${
                        isDragging 
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' 
                            : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30'
                    }`}
                >
                    {uploading ? (
                        <div className="flex flex-col items-center gap-2 py-6">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Merging &amp; Uploading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-center mb-2">
                                <FilePlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Drag &amp; drop documents here</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">Auto-merges PDFs and images into one PDF</p>

                            <div className="w-full space-y-2 mt-auto">
                                <select 
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option>Purchase / Proforma Invoice</option>
                                    <option>Warranty Certificate</option>
                                    <option>Delivery Note</option>
                                    <option>Service / Repair Reports</option>
                                    <option>Other</option>
                                </select>
                                
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/20"
                                >
                                    <UploadCloud className="w-3.5 h-3.5" /> Upload Document
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
                multiple
                accept="application/pdf, image/*" 
                onChange={handleFileChange}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 mx-auto">
                            <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-center text-slate-800 dark:text-white mb-2">Delete Document?</h3>
                        <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">This action cannot be undone. The document will be permanently removed from storage.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition">Cancel</button>
                            <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
