/**
 * Dropdown Options API
 * Manages custom/user-defined values for asset form dropdowns.
 * Custom options are stored per field name in the database.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth.middleware');

// In-memory cache for dropdown options (refreshed on write)
let optionsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function loadOptions() {
  const now = Date.now();
  if (optionsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return optionsCache;
  }
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT "customOptions" FROM "SystemSettings" WHERE id = 'global' LIMIT 1
    `);
    const raw = rows?.[0]?.customOptions;
    if (raw) {
      optionsCache = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } else {
      optionsCache = {};
    }
  } catch (_) {
    optionsCache = {};
  }
  cacheTimestamp = Date.now();
  return optionsCache;
}

function invalidateCache() {
  optionsCache = null;
  cacheTimestamp = 0;
}

async function saveOptions(options) {
  const json = JSON.stringify(options);
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "SystemSettings"
      SET "customOptions" = $1::jsonb, "updatedAt" = NOW()
      WHERE id = 'global'
    `, json);
  } catch (_) {
    // Fallback: column may not exist yet, try text type
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "SystemSettings"
        SET "customOptions" = $1, "updatedAt" = NOW()
        WHERE id = 'global'
      `, json);
    } catch (err) {
      throw err;
    }
  }
  invalidateCache();
}

// GET /api/dropdown-options/:field
// Returns custom options for a specific field, or all fields if :field is 'all'
router.get('/:field', authenticate, async (req, res) => {
  try {
    const options = await loadOptions();
    const { field } = req.params;
    if (field === 'all') {
      return res.json(options);
    }
    return res.json(options[field] || []);
  } catch (err) {
    console.error('Dropdown Options GET Error:', err);
    res.status(500).json({ error: 'Failed to fetch dropdown options' });
  }
});

// POST /api/dropdown-options/:field
// Adds a new custom option for a field (deduplicates automatically)
router.post('/:field', authenticate, async (req, res) => {
  try {
    const { field } = req.params;
    const { value } = req.body;

    if (!value || !value.trim()) {
      return res.status(400).json({ error: 'Value is required' });
    }
    const trimmed = value.trim();

    // Load existing options
    const options = await loadOptions();
    const existing = options[field] || [];

    // Case-insensitive deduplicate check
    const isDuplicate = existing.some(
      (v) => v.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      return res.json({ success: true, added: false, value: trimmed, options: existing });
    }

    // Add the new value and persist
    const updated = [...existing, trimmed];
    options[field] = updated;
    await saveOptions(options);

    return res.json({ success: true, added: true, value: trimmed, options: updated });
  } catch (err) {
    console.error('Dropdown Options POST Error:', err);
    res.status(500).json({ error: 'Failed to save dropdown option' });
  }
});

// DELETE /api/dropdown-options/:field/:value
// Removes a custom option (admin only)
router.delete('/:field/:value', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { field, value } = req.params;
    const decoded = decodeURIComponent(value);

    const options = await loadOptions();
    const existing = options[field] || [];
    options[field] = existing.filter((v) => v !== decoded);
    await saveOptions(options);

    return res.json({ success: true, options: options[field] });
  } catch (err) {
    console.error('Dropdown Options DELETE Error:', err);
    res.status(500).json({ error: 'Failed to delete dropdown option' });
  }
});

module.exports = router;

