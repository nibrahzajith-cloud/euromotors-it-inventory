export const downloadQRCard = (assetCode, elementId = "single-qr-card") => {
  const qrContainer = document.getElementById(elementId);
  if (!qrContainer) return { success: false, error: "QR Container not found" };
  const qrCanvas = qrContainer.querySelector("canvas");
  if (!qrCanvas) return { success: false, error: "Canvas not rendered" };
  
  try {
     const canvas = document.createElement("canvas");
     const ctx = canvas.getContext("2d");
     
     const scale = 4;
     const padding = 24 * scale;
     const qrSize = 140 * scale;
     const textHeight = 30 * scale;
     
     canvas.width = qrSize + (padding * 2);
     canvas.height = qrSize + (padding * 2) + textHeight;
     
     // Card Shadow (subtle)
     ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
     ctx.shadowBlur = 12;
     ctx.shadowOffsetY = 4;
     
     // Background
     ctx.fillStyle = "#ffffff";
     ctx.beginPath();
     ctx.roundRect(0, 0, canvas.width, canvas.height, 20 * scale);
     ctx.fill();
     
     // Border
     ctx.shadowColor = "transparent";
     ctx.lineWidth = 1.5 * scale;
     ctx.strokeStyle = "#e2e8f0";
     ctx.stroke();

     // Draw QR
     ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize);
     
     // Draw Text
     ctx.fillStyle = "#1e293b";
     ctx.font = `bold ${18 * scale}px monospace`;
     ctx.textAlign = "center";
     ctx.fillText(assetCode.trim(), canvas.width / 2, canvas.height - padding);
     
     const imgData = canvas.toDataURL('image/png');
     const a = document.createElement('a');
     a.href = imgData;
     a.download = `QR_${assetCode.trim()}.png`;
     a.click();
     return { success: true };
  } catch(err) {
     console.error("CANVAS ERROR:", err);
     return { success: false, error: err.message };
  }
};
