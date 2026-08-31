import { useState, useRef, useCallback, useEffect } from 'react';
import { 
    FileText, UploadCloud, Trash2, RefreshCw, 
    Download, ExternalLink, Loader2, CheckCircle2, 
    AlertCircle, Layers, Plus, X, ChevronRight,
    FileCheck, Shield, Clock, Info
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import imageCompression from 'browser-image-compression';
import { useToast } from '../../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export const OFFICIAL_PROCUREMENT_CATEGORIES = [
    { id: 'request', name: 'Asset Document Request', description: 'Asset request email or formal request letter', required: true },
    { id: 'approval', name: 'Department Head Approval', description: 'Email, letter, or approval from Dept Head', required: true },
    { id: 'quote1', name: 'Quotation / Invoice — Company 1', description: 'First supplier quotation/invoice', required: true },
    { id: 'quote2', name: 'Quotation / Invoice — Company 2', description: 'Second supplier quotation/invoice', required: true },
    { id: 'quote3', name: 'Quotation / Invoice — Company 3', description: 'Third supplier quotation/invoice', required: true },
    { id: 'approved_quote', name: 'Approved Quotation / Invoice', description: 'Final quotation/invoice approved for purchase', required: true },
    { id: 'delivery', name: 'Delivery Note', description: 'Supplier delivery documentation', required: true },
    { id: 'warranty', name: 'Warranty Card', description: 'Warranty card/certificate where applicable', required: true },
    { id: 'other', name: 'Other Supporting Document', description: 'Additional supporting documentation', required: false }
];

export default function AssetDocuments({ asset, onUpdate }) {
    const { showToast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [uploadProgressText, setUploadProgressText] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [documents, setDocuments] = useState([]);
    
    // Modal States
    const [uploadMode, setUploadMode] = useState(null); // 'combined' | 'multi' | null
    const [selectedFiles, setSelectedFiles] = useState([]); // [{ file, category, previewUrl }]
    const [showChecklistModal, setShowChecklistModal] = useState(false);

    const singleFileInputRef = useRef(null);
    const multiFileInputRef = useRef(null);

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
                    if (res.headers.get('content-type')?.includes('application/json')) {
                        const data = await res.json();
                        if (!cancelled) setDocuments(data);
                    }
                } else {
                    if (res.headers.get('content-type')?.includes('application/json')) {
                        const err = await res.json();
                        console.error('Failed to fetch documents:', err);
                    }
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

    // OPTION A: Handle Direct Combined PDF Upload
    const handleCombinedUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            return showToast('Only PDF format is supported for combined upload', 'error');
        }

        if (file.size > 2 * 1024 * 1024) {
            return showToast('Combined PDF exceeds the maximum 2 MB limit', 'error');
        }

        setUploading(true);
        setUploadProgressText('Uploading Combined Asset Document...');

        try {
            const formData = new FormData();
            formData.append('document', file);
            formData.append('documentType', 'Combined Procurement Document');

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/document/${asset.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) {
                let errorMessage = 'Failed to upload document';
                if (res.headers.get('content-type')?.includes('application/json')) {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const newDoc = res.headers.get('content-type')?.includes('application/json') 
                ? await res.json() 
                : null;
            if (newDoc) {
                setDocuments([newDoc]);
            }
            setUploadMode(null);
            showToast('Combined Asset Document uploaded successfully', 'success');
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgressText('');
            if (singleFileInputRef.current) singleFileInputRef.current.value = '';
        }
    };

    // OPTION B: Handle Multi-File Selection & Categorization
    const handleMultiFilesSelected = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (files.length > 10) {
            return showToast('Maximum 10 files allowed in a single multi-upload', 'error');
        }

        for (const file of files) {
            if (file.size > 2 * 1024 * 1024) {
                return showToast(`File "${file.name}" exceeds the 2 MB per-file limit`, 'error');
            }
            if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
                return showToast(`File "${file.name}" is not a supported PDF or JPG/PNG image`, 'error');
            }
        }

        // Initialize file mapping with default sequence categories
        const mapped = files.map((file, idx) => {
            const defaultCat = OFFICIAL_PROCUREMENT_CATEGORIES[Math.min(idx, OFFICIAL_PROCUREMENT_CATEGORIES.length - 1)].name;
            return {
                id: `${file.name}-${idx}-${Date.now()}`,
                file,
                category: defaultCat,
            };
        });

        setSelectedFiles(mapped);
        setUploadMode('multi-categorize');
    };

    const updateFileCategory = (id, newCategory) => {
        setSelectedFiles(prev => prev.map(item => item.id === id ? { ...item, category: newCategory } : item));
    };

    const removeSelectedFile = (id) => {
        setSelectedFiles(prev => prev.filter(item => item.id !== id));
    };

    // Process & Merge Categorized Files into Archival PDF
    const processAndMergeCategorizedFiles = async () => {
        if (selectedFiles.length === 0) return;
        setUploading(true);
        setUploadProgressText('Optimizing & Ordering Procurement Documents...');

        try {
            // Sort selected files by standard Euro Motors category order
            const categoryOrderMap = new Map(OFFICIAL_PROCUREMENT_CATEGORIES.map((cat, idx) => [cat.name, idx]));
            const sortedFiles = [...selectedFiles].sort((a, b) => {
                const orderA = categoryOrderMap.has(a.category) ? categoryOrderMap.get(a.category) : 999;
                const orderB = categoryOrderMap.has(b.category) ? categoryOrderMap.get(b.category) : 999;
                return orderA - orderB;
            });

            // Create Master PDF Document
            const pdfDoc = await PDFDocument.create();

            for (let i = 0; i < sortedFiles.length; i++) {
                const item = sortedFiles[i];
                setUploadProgressText(`Processing [${i + 1}/${sortedFiles.length}]: ${item.category}...`);

                if (item.file.type === 'application/pdf') {
                    const arrayBuffer = await item.file.arrayBuffer();
                    const importedPdf = await PDFDocument.load(arrayBuffer);
                    const copiedPages = await pdfDoc.copyPages(importedPdf, importedPdf.getPageIndices());
                    copiedPages.forEach((page) => pdfDoc.addPage(page));
                } else if (item.file.type.startsWith('image/')) {
                    // Safe compression preserving crisp invoices, signatures & stamps
                    const compressedImg = await imageCompression(item.file, {
                        maxSizeMB: 1.5,
                        maxWidthOrHeight: 2048,
                        useWebWorker: true,
                        fileType: item.file.type === 'image/png' ? 'image/png' : 'image/jpeg',
                        initialQuality: 0.90
                    });
                    const imgBuffer = await compressedImg.arrayBuffer();
                    
                    let pdfImage;
                    if (compressedImg.type === 'image/png') {
                        pdfImage = await pdfDoc.embedPng(imgBuffer);
                    } else {
                        pdfImage = await pdfDoc.embedJpg(imgBuffer);
                    }

                    // A4 Standard Dimension: 595.28 x 841.89 pt
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

            setUploadProgressText('Generating Archival PDF...');
            const pdfBytes = await pdfDoc.save();
            const mergedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            if (mergedBlob.size > 2 * 1024 * 1024) {
                throw new Error('Final merged PDF exceeds the 2 MB limit. Please compress source images.');
            }

            setUploadProgressText('Uploading to Private R2 Storage...');
            const formData = new FormData();
            formData.append('document', new File([mergedBlob], `${asset.assetCode}_procurement_docs.pdf`, { type: 'application/pdf' }));
            formData.append('documentType', 'Procurement Document Bundle');

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/document/${asset.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) {
                let errorMessage = 'Failed to upload document bundle';
                if (res.headers.get('content-type')?.includes('application/json')) {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const newDoc = res.headers.get('content-type')?.includes('application/json')
                ? await res.json()
                : null;
            if (newDoc) {
                setDocuments([newDoc]);
            }
            setUploadMode(null);
            setSelectedFiles([]);
            showToast('Procurement documents merged & uploaded successfully', 'success');
            if (onUpdate) onUpdate();

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgressText('');
            if (multiFileInputRef.current) multiFileInputRef.current.value = '';
        }
    };

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
            if (!res.ok) {
                let errorMessage = 'Failed to generate secure link';
                if (res.headers.get('content-type')?.includes('application/json')) {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                }
                throw new Error(errorMessage);
            }
            if (!res.headers.get('content-type')?.includes('application/json')) {
                throw new Error('Server returned invalid response format');
            }
            
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
            if (!res.ok) {
                let errorMessage = 'Failed to retrieve view link';
                if (res.headers.get('content-type')?.includes('application/json')) {
                    const err = await res.json();
                    errorMessage = err.error || errorMessage;
                }
                throw new Error(errorMessage);
            }
            if (!res.headers.get('content-type')?.includes('application/json')) {
                throw new Error('Server returned invalid response format');
            }
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
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowChecklistModal(true)}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-1 rounded-lg transition flex items-center gap-1 border border-blue-200/50 dark:border-blue-800/30"
                    >
                        <FileCheck className="w-3.5 h-3.5" /> Checklist
                    </button>
                    {hasDocument && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                            PDF Attached
                        </span>
                    )}
                </div>
            </div>

            {hasDocument ? (
                <div className="flex flex-col flex-1">
                    {/* Document Info Card */}
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
                                    {currentDoc.documentType || 'Procurement Document Bundle'}
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

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 mt-auto pt-3">
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
                            onClick={() => setUploadMode('select-option')} 
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

                    <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2">
                        PDF, JPG, PNG supported • Maximum document size: 2 MB
                    </p>
                </div>
            ) : (
                /* Empty State: Two Direct Options */
                <div className="flex flex-col flex-1 justify-between">
                    <div className="flex-1 min-h-[200px] border-2 border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-4 flex flex-col justify-between">
                        {uploading ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-8 my-auto">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center">{uploadProgressText || 'Processing...'}</p>
                            </div>
                        ) : (
                            <>
                                <div className="text-center">
                                    <div className="w-10 h-10 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-center mx-auto mb-2">
                                        <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Asset Procurement Documents</p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">Structured Euro Motors procurement document workflow</p>
                                </div>

                                <div className="space-y-2 mt-auto">
                                    {/* Option A */}
                                    <button 
                                        onClick={() => singleFileInputRef.current?.click()}
                                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-between shadow-sm shadow-blue-600/20"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <UploadCloud className="w-3.5 h-3.5" /> Option A: Upload Combined PDF
                                        </span>
                                        <span className="text-[10px] opacity-80">Max 2MB</span>
                                    </button>

                                    {/* Option B */}
                                    <button 
                                        onClick={() => multiFileInputRef.current?.click()}
                                        className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-between"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Plus className="w-3.5 h-3.5" /> Option B: Upload Multiple Documents
                                        </span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-400">Up to 10 Files</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2">
                        PDF, JPG, PNG supported • Maximum document size: 2 MB
                    </p>
                </div>
            )}

            {/* Hidden File Inputs */}
            <input 
                type="file" 
                ref={singleFileInputRef} 
                className="hidden" 
                accept="application/pdf" 
                onChange={handleCombinedUpload}
            />
            <input 
                type="file" 
                ref={multiFileInputRef} 
                className="hidden" 
                multiple
                accept="application/pdf,image/jpeg,image/png" 
                onChange={handleMultiFilesSelected}
            />

            {/* Replace Modal (Option Chooser) */}
            {uploadMode === 'select-option' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-blue-600" /> Replace Asset Documents
                            </h3>
                            <button onClick={() => setUploadMode(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                            Choose how you would like to replace the procurement document bundle:
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => { setUploadMode(null); singleFileInputRef.current?.click(); }}
                                className="w-full p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-left transition flex items-start gap-3"
                            >
                                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">Option A: Upload Single Combined PDF</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Upload an already-prepared combined PDF file (Max 2 MB).</p>
                                </div>
                            </button>

                            <button
                                onClick={() => { setUploadMode(null); multiFileInputRef.current?.click(); }}
                                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition flex items-start gap-3"
                            >
                                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                                    <Layers className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">Option B: Upload &amp; Categorize Multiple Files</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Select up to 10 PDF/Image files and auto-merge in standard sequence.</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OPTION B: Categorization & Ordering Modal */}
            {uploadMode === 'multi-categorize' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3 mb-4 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-blue-600" /> Assign Document Categories
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Map each file to Euro Motors standard procurement categories. Pages will be auto-ordered accordingly.
                                </p>
                            </div>
                            <button onClick={() => setUploadMode(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* File list */}
                        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
                            {selectedFiles.map((item, index) => (
                                <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
                                            {index + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.file.name}>
                                                {item.file.name}
                                            </p>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                {formatBytes(item.file.size)} • {item.file.type.includes('pdf') ? 'PDF' : 'Image'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <select
                                            value={item.category}
                                            onChange={(e) => updateFileCategory(item.id, e.target.value)}
                                            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                                        >
                                            {OFFICIAL_PROCUREMENT_CATEGORIES.map(cat => (
                                                <option key={cat.name} value={cat.name}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button 
                                            onClick={() => removeSelectedFile(item.id)}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition"
                                            title="Remove File"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4 flex items-center justify-between shrink-0">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected
                            </span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setUploadMode(null)} 
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={processAndMergeCategorizedFiles} 
                                    disabled={uploading || selectedFiles.length === 0}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 shadow-sm shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                                    Merge &amp; Upload PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Checklist Modal */}
            {showChecklistModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3 mb-4 shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <FileCheck className="w-5 h-5 text-blue-600" /> Procurement Document Checklist
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Euro Motors Official Standard Document Sequence
                                </p>
                            </div>
                            <button onClick={() => setShowChecklistModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                            {OFFICIAL_PROCUREMENT_CATEGORIES.map((cat, idx) => {
                                const isAttached = hasDocument;
                                return (
                                    <div key={cat.id} className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/70 bg-slate-50/50 dark:bg-slate-900/30 flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                    {cat.name}
                                                </p>
                                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                                    {cat.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {isAttached ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                                                    <CheckCircle2 className="w-3 h-3" /> Available
                                                </span>
                                            ) : cat.required ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40">
                                                    <AlertCircle className="w-3 h-3" /> Missing
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    Optional
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
                            <span>Status: {hasDocument ? 'Procurement document attached' : 'No document bundle attached yet'}</span>
                            <button 
                                onClick={() => setShowChecklistModal(false)}
                                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 mx-auto">
                            <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-center text-slate-800 dark:text-white mb-2">Delete Document?</h3>
                        <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">This action cannot be undone. The procurement document will be permanently removed from storage.</p>
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
