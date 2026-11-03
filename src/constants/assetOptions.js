/**
 * Standardized IT Asset Configuration & Enterprise Validation Options
 * Enforces uniform, structured data entry across Euro Motors IT Inventory.
 */

export const STANDARD_DEVICE_TYPES = [
  'Laptop',
  'Desktop',
  'Monitor',
  'Mobile Phone',
  'Tablet',
  'Printer',
  'Photocopier',
  'Telephone',
  'Mouse',
  'Keyboard',
  'Router',
  'Switch',
  'Access Point',
  'CCTV Camera',
  'NVR / DVR',
  'UPS',
  'Portable SSD',
  'Portable Harddrive',
  'Pen Drive',
  'Smart Board',
  'TV / Display',
  'Attendance Device',
  'Server',
  'Other Hardware'
];

export const STANDARD_BRANDS = [
  'HP',
  'Dell',
  'Lenovo',
  'ASUS',
  'Apple',
  'Acer',
  'Samsung',
  'Panasonic',
  'Logitech',
  'Meetion',
  'Canon',
  'Epson',
  'HIKVISION',
  'Dahua',
  'Cisco',
  'TP-Link',
  'D-Link',
  'Prolink',
  'Huawei',
  'Dialog',
  'SLT',
  'Microsoft',
  'Kingston',
  'Western Digital',
  'Seagate',
  'Sell X',
  'LaptopCare',
  'TechnoAsia',
  'Other'
];

export const STANDARD_CONDITIONS = [
  'New',
  'Good',
  'Fair',
  'Poor',
  'Damaged'
];

export const STANDARD_WARRANTY_STATUSES = [
  'Active',
  'Expired',
  'None',
  'Extended'
];

export const STANDARD_PROCESSORS = [
  'N/A',
  'Intel Core i3',
  'Intel Core i5',
  'Intel Core i7',
  'Intel Core i9',
  'Intel Core Ultra 5',
  'Intel Core Ultra 7',
  'Intel Core Ultra 9',
  'AMD Ryzen 3',
  'AMD Ryzen 5',
  'AMD Ryzen 7',
  'AMD Ryzen 9',
  'Apple M1',
  'Apple M2',
  'Apple M3',
  'Apple M4',
  'Intel Xeon',
  'Intel Celeron / Pentium',
  'Other Processor'
];

export const STANDARD_RAM_OPTIONS = [
  'N/A',
  '2GB',
  '4GB',
  '8GB',
  '12GB',
  '16GB',
  '24GB',
  '32GB',
  '64GB',
  '128GB'
];

export const STANDARD_STORAGE_OPTIONS = [
  'N/A',
  '128GB SSD',
  '256GB SSD',
  '512GB SSD',
  '1TB SSD',
  '2TB SSD',
  '500GB HDD',
  '1TB HDD',
  '2TB HDD',
  '32GB eMMC',
  '64GB eMMC',
  '128GB eMMC',
  'Other Storage'
];

export const STANDARD_OS_OPTIONS = [
  'N/A',
  'Windows 11 Pro',
  'Windows 11 Home',
  'Windows 10 Pro',
  'Windows 10 Home',
  'macOS',
  'Linux / Ubuntu',
  'Android',
  'iOS',
  'ChromeOS',
  'Embedded / Firmware'
];

export const REQUIRES_MODEL_TYPES = [
  'Laptop',
  'Desktop',
  'Tablet',
  'Mobile Phone',
  'Server',
  'Router',
  'Switch',
  'Printer',
  'Photocopier'
];

export const PERIPHERAL_TYPES = [
  'Mouse',
  'Keyboard',
  'Telephone',
  'Portable SSD',
  'Portable Harddrive',
  'Pen Drive',
  'Access Point',
  'CCTV Camera',
  'UPS',
  'Cable',
  'Adapter'
];

export function isPeripheralDevice(deviceType = '') {
  const dt = (deviceType || '').toLowerCase();
  return PERIPHERAL_TYPES.some(p => dt.includes(p.toLowerCase()));
}

export function isValidMacAddress(mac) {
  if (!mac || !mac.trim()) return true;
  return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac.trim());
}

export function isValidIpv4(ip) {
  if (!ip || !ip.trim()) return true;
  return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip.trim());
}
