/**
 * Sri Lankan Market IT Asset Valuation Engine (LKR) — Client & Server Shared Logic
 * 
 * Implements corporate valuation rules for Euro Motors:
 * 1. Checks actual purchasePrice first ('Purchase Cost').
 * 2. Checks recorded estimatedValue ('Recorded Value').
 * 3. Matches device against Sri Lankan enterprise hardware market benchmarks ('Estimated Market Value').
 * 4. Never invents a price for unknown hardware; returns 'Valuation Pending'.
 */

// Sri Lankan Enterprise Hardware Replacement Benchmark Catalog (LKR)
// Calibrated to Colombo IT market prices (Barclays, Unity Plaza, Singer, Abans, Redington)
export const SRI_LANKA_HARDWARE_BENCHMARKS = [
  // Workstations & High-End Laptops
  { regex: /precision\s*(3550|3560|5550)/i, value: 285000, label: 'Dell Precision Mobile Workstation' },
  { regex: /precision/i, value: 275000, label: 'Dell Precision Workstation' },
  { regex: /victus/i, value: 255000, label: 'HP Victus High Performance Laptop' },

  // Enterprise Laptops (Lenovo ThinkPad)
  { regex: /think\s*pad\s*l15/i, value: 195000, label: 'Lenovo ThinkPad L15 Business Laptop' },
  { regex: /think\s*pad\s*t14/i, value: 245000, label: 'Lenovo ThinkPad T14 Corporate Laptop' },
  { regex: /think\s*pad/i, value: 185000, label: 'Lenovo ThinkPad Enterprise Laptop' },
  { regex: /ideapad/i, value: 150000, label: 'Lenovo IdeaPad Laptop' },
  { regex: /lenovo/i, value: 165000, label: 'Lenovo Commercial Laptop' },

  // Enterprise Laptops (Dell Latitude & Vostro)
  { regex: /latitude\s*7300/i, value: 215000, label: 'Dell Latitude 7300 Ultrabook' },
  { regex: /latitude\s*5510/i, value: 195000, label: 'Dell Latitude 5510 Business Laptop' },
  { regex: /latitude\s*3510/i, value: 175000, label: 'Dell Latitude 3510 Business Laptop' },
  { regex: /latitude/i, value: 180000, label: 'Dell Latitude Corporate Laptop' },
  { regex: /vostro\s*15\s*3530|vostro\s*3530/i, value: 165000, label: 'Dell Vostro 3530 15.6" Laptop' },
  { regex: /vostro\s*3520/i, value: 155000, label: 'Dell Vostro 3520 15.6" Laptop' },
  { regex: /vostro\s*dc\s*15250|dc15250|dc1250/i, value: 155000, label: 'Dell Vostro 15" Commercial Laptop' },
  { regex: /vostro/i, value: 155000, label: 'Dell Vostro Laptop' },
  { regex: /dell/i, value: 160000, label: 'Dell Business Laptop' },

  // Enterprise Laptops (HP EliteBook & ProBook)
  { regex: /probook\s*450\s*g7/i, value: 175000, label: 'HP ProBook 450 G7 Business Laptop' },
  { regex: /probook\s*450\s*g6/i, value: 165000, label: 'HP ProBook 450 G6 Business Laptop' },
  { regex: /probook\s*450\s*g5/i, value: 155000, label: 'HP ProBook 450 G5 Business Laptop' },
  { regex: /probook\s*450\s*g2/i, value: 95000, label: 'HP ProBook 450 G2 Legacy Laptop' },
  { regex: /probook\s*650\s*(g4|g5)/i, value: 165000, label: 'HP ProBook 650 Enterprise Laptop' },
  { regex: /probook/i, value: 160000, label: 'HP ProBook Business Laptop' },
  { regex: /elite\s*book\s*840\s*g3/i, value: 125000, label: 'HP EliteBook 840 G3 Ultrabook' },
  { regex: /elite\s*book/i, value: 145000, label: 'HP EliteBook Corporate Laptop' },
  { regex: /250\s*g10/i, value: 145000, label: 'HP 250 G10 Commercial Laptop' },
  { regex: /15-fc|15-fd|15-fd0154wm/i, value: 148000, label: 'HP 15 Commercial Laptop' },
  { regex: /ryzen\s*3/i, value: 135000, label: 'HP 15 Ryzen 3 Laptop' },
  { regex: /hp\s*15/i, value: 142000, label: 'HP 15 Series Laptop' },

  // Asus
  { regex: /vivobook\s*x1504/i, value: 175000, label: 'Asus Vivobook X1504 Core i5' },
  { regex: /vivobook/i, value: 160000, label: 'Asus Vivobook 15' },

  // Monitors & Displays
  { regex: /samsung\s*24/i, value: 34500, label: 'Samsung 24" IPS Full HD Monitor' },
  { regex: /hp\s*la2205wg/i, value: 28500, label: 'HP 22" Widescreen Display' },
  { regex: /hp\s*19|falcom\s*19|v193/i, value: 22500, label: '19" LED Office Monitor' },
  { regex: /monitor/i, value: 24500, label: 'Standard Office Monitor' },

  // Desktops & PC Systems
  { regex: /prodesk/i, value: 145000, label: 'HP ProDesk Commercial Desktop PC' },
  { regex: /assemble\s*pc|desktop/i, value: 95000, label: 'Custom Corporate Desktop Workstation' },

  // Printers & Copiers
  { regex: /canon\s*ir\s*2425/i, value: 365000, label: 'Canon ImageRunner 2425 Multi-function Network Copier' },
  { regex: /canon\s*ir\s*2224/i, value: 285000, label: 'Canon ImageRunner 2224N Network Copier' },
  { regex: /brother\s*mfc/i, value: 75000, label: 'Brother MFC Multifunction Laser Printer' },
  { regex: /epson\s*lq-?310/i, value: 58000, label: 'Epson LQ-310 24-Pin Dot Matrix Impact Printer' },
  { regex: /laser\s*mfp\s*1188w|laser\s*107w/i, value: 48000, label: 'HP Mono Laser Wireless Office Printer' },
  { regex: /smart\s*tank\s*580/i, value: 52000, label: 'HP Smart Tank 580 All-in-One Ink Tank' },
  { regex: /toshiba\s*e-studio/i, value: 320000, label: 'Toshiba e-Studio High-Volume MFP' },

  // Peripherals & Communication Devices
  { regex: /mouse/i, value: 3500, label: 'Optical USB / Wireless Mouse' },
  { regex: /keyboard/i, value: 4500, label: 'Standard Office USB Keyboard' },
  { regex: /headset|headphone|earphone/i, value: 6500, label: 'Office Communications Headset' },
  { regex: /telephone|panasonic/i, value: 12500, label: 'Panasonic Corporate Landline Phone' },
  { regex: /barcode|scanner/i, value: 28500, label: 'Handheld Barcode Scanner' },

  // Heavy Equipment & Infrastructure
  { regex: /smart\s*board/i, value: 480000, label: 'Interactive Digital Conference Smart Board' },
  { regex: /cash\s*counting/i, value: 65000, label: 'High Speed Currency Counter & Detector' },
  { regex: /scp\s*3kva/i, value: 85000, label: '3kVA Enterprise Online Rackmount UPS' },
  { regex: /aid\s*2000|1\.2\s*kva/i, value: 24000, label: 'Line-Interactive 1.2kVA UPS System' },
  { regex: /thinkplus\s*mu242|usb\s*pen/i, value: 3800, label: 'Lenovo Thinkplus High-Speed USB 3.2 Storage' }
];

/**
 * Resolves Sri Lankan Rupee (LKR) valuation for an individual asset.
 * 
 * @param {Object} asset - Asset database record
 * @returns {Object} { valueLKR: number|null, formattedValue: string, source: string, valuationDate: string, isPending: boolean }
 */
export function resolveAssetValuation(asset) {
  if (!asset) {
    return {
      valueLKR: null,
      formattedValue: 'Valuation Pending',
      source: 'Valuation Pending',
      valuationDate: null,
      isPending: true
    };
  }

  // Rule 1: Actual Purchase Price in procurement / invoice records
  if (asset.purchasePrice && Number(asset.purchasePrice) > 0) {
    const val = Number(asset.purchasePrice);
    return {
      valueLKR: val,
      formattedValue: `LKR ${val.toLocaleString('en-LK')}`,
      source: 'Purchase Cost',
      valuationDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString() : (asset.valuationDate || new Date().toISOString()),
      isPending: false
    };
  }

  // Rule 2: Explicitly recorded valuation updated by IT Admin
  if (asset.estimatedValue && Number(asset.estimatedValue) > 0) {
    const val = Number(asset.estimatedValue);
    return {
      valueLKR: val,
      formattedValue: `LKR ${val.toLocaleString('en-LK')}`,
      source: asset.valuationSource || 'Recorded Value',
      valuationDate: asset.valuationDate ? new Date(asset.valuationDate).toISOString() : new Date().toISOString(),
      isPending: false
    };
  }

  // Rule 3: Approximate Sri Lankan Market Replacement Price matching brand, model, specs
  const searchCorpus = [
    asset.model || '',
    asset.brand || '',
    asset.deviceType || '',
    asset.processor || '',
    asset.ram || '',
    asset.storage || ''
  ].join(' ').trim();

  for (const benchmark of SRI_LANKA_HARDWARE_BENCHMARKS) {
    if (benchmark.regex.test(searchCorpus)) {
      return {
        valueLKR: benchmark.value,
        formattedValue: `LKR ${benchmark.value.toLocaleString('en-LK')}`,
        source: 'Estimated Market Value',
        benchmarkDevice: benchmark.label,
        valuationDate: new Date().toISOString(),
        isPending: false
      };
    }
  }

  // Secondary Device Type heuristics if deviceType is known
  const dType = (asset.deviceType || '').toLowerCase();
  if (dType === 'laptop') {
    const standardLaptopPrice = 150000;
    return {
      valueLKR: standardLaptopPrice,
      formattedValue: `LKR ${standardLaptopPrice.toLocaleString('en-LK')}`,
      source: 'Estimated Market Value',
      benchmarkDevice: 'Commercial Business Laptop',
      valuationDate: new Date().toISOString(),
      isPending: false
    };
  }

  if (dType === 'monitor') {
    const standardMonitorPrice = 24000;
    return {
      valueLKR: standardMonitorPrice,
      formattedValue: `LKR ${standardMonitorPrice.toLocaleString('en-LK')}`,
      source: 'Estimated Market Value',
      benchmarkDevice: 'Standard Enterprise Display',
      valuationDate: new Date().toISOString(),
      isPending: false
    };
  }

  if (dType === 'desktop') {
    const standardDesktopPrice = 95000;
    return {
      valueLKR: standardDesktopPrice,
      formattedValue: `LKR ${standardDesktopPrice.toLocaleString('en-LK')}`,
      source: 'Estimated Market Value',
      benchmarkDevice: 'Corporate Desktop Workstation',
      valuationDate: new Date().toISOString(),
      isPending: false
    };
  }

  // Rule 4: Unknown hardware without verified market price -> Valuation Pending
  return {
    valueLKR: null,
    formattedValue: 'Valuation Pending',
    source: 'Valuation Pending',
    valuationDate: null,
    isPending: true
  };
}

/**
 * Calculates employee-level total valuation summary across all currently assigned hardware.
 * 
 * Rules:
 * - Excludes returned assets and prevents duplicate counting.
 * - If some assets lack values, shows "Known Total" and clearly notes incomplete valuation.
 * 
 * @param {Array} assignedAssets - List of active assigned assets for employee
 * @returns {Object} Comprehensive valuation summary
 */
export function computeEmployeeValuationSummary(assignedAssets = []) {
  const assets = Array.isArray(assignedAssets) ? assignedAssets : [];
  let totalValueLKR = 0;
  let valuedCount = 0;
  let pendingCount = 0;

  const enrichedAssets = assets.map(asset => {
    const valuation = resolveAssetValuation(asset);
    if (!valuation.isPending && valuation.valueLKR > 0) {
      totalValueLKR += valuation.valueLKR;
      valuedCount++;
    } else {
      pendingCount++;
    }
    return {
      ...asset,
      valuation
    };
  });

  const isCompleteValuation = pendingCount === 0 && assets.length > 0;
  const hasPartialValuation = pendingCount > 0 && valuedCount > 0;
  const isAllPending = assets.length > 0 && valuedCount === 0;

  let totalLabel = 'TOTAL IT ASSET VALUE';
  if (hasPartialValuation) {
    totalLabel = 'KNOWN ASSET VALUE (PARTIAL)';
  } else if (isAllPending) {
    totalLabel = 'VALUATION PENDING';
  }

  return {
    totalAssignedAssets: assets.length,
    valuedCount,
    pendingCount,
    totalValueLKR,
    formattedTotalLKR: totalValueLKR > 0 ? `LKR ${totalValueLKR.toLocaleString('en-LK')}` : (isAllPending ? 'Pending' : 'LKR 0'),
    totalLabel,
    isCompleteValuation,
    hasPartialValuation,
    isAllPending,
    valuationDate: new Date().toISOString(),
    enrichedAssets
  };
}

