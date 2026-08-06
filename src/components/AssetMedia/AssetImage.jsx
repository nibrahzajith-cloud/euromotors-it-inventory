import React from 'react';
import { Image as ImageIcon, Construction, Clock, CloudOff } from 'lucide-react';

/**
 * AssetImage — PRODUCTION PLACEHOLDER
 *
 * The Asset Image Management module is currently under active development.
 * Full functionality (Cloudflare R2 storage, upload, camera capture, compression,
 * preview, download, delete) is being developed and tested locally on the
 * feature/enterprise-asset-media-r2 branch.
 *
 * This placeholder will be replaced once the R2 integration is fully tested
 * and approved for production deployment.
 *
 * DO NOT REMOVE — original implementation is preserved in the feature branch.
 */
export default function AssetImage({ asset, onUpdate }) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-full">
            {/* Section Header — unchanged layout */}
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                <ImageIcon className="w-5 h-5 text-slate-400" />
                Asset Image
                <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                    <Clock className="w-3 h-3" />
                    Coming Soon
                </span>
            </h3>

            {/* Placeholder Body */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-center gap-4">

                {/* Icon */}
                <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/50 border-2 border-white dark:border-slate-800 flex items-center justify-center">
                        <Construction className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                </div>

                {/* Message */}
                <div className="max-w-[220px]">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Feature Under Development
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        The Asset Image Management module is currently under development.
                        This feature will be available in a future software release after
                        the cloud storage integration has been completed.
                    </p>
                </div>

                {/* Greyed-out action buttons — intentionally disabled */}
                <div className="flex w-full gap-2 mt-2">
                    <button
                        disabled
                        title="Not available — feature under development"
                        className="flex-1 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
                    >
                        <CloudOff className="w-3.5 h-3.5" />
                        Upload
                    </button>
                    <button
                        disabled
                        title="Not available — feature under development"
                        className="flex-1 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
                    >
                        <CloudOff className="w-3.5 h-3.5" />
                        Camera
                    </button>
                </div>
            </div>
        </div>
    );
}
