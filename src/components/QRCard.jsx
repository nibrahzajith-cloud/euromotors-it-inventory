import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function QRCard({ assetCode, id = "single-qr-card", size = 140 }) {
  return (
    <div 
      id={id} 
      className="bg-white border border-slate-200 rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center p-8 w-[240px] aspect-square mx-auto"
    >
      <QRCodeCanvas value={assetCode} size={size} level="H" includeMargin={false} />
      <span className="mt-5 font-bold font-mono text-slate-800 text-[18px] text-center w-full truncate block">
        {assetCode}
      </span>
    </div>
  );
}
