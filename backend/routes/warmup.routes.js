const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

const startTime = Date.now();

/**
 * GET /api/warmup
 *
 * Lightweight endpoint to pre-warm the Neon PostgreSQL connection and
 * wake the Render server before the user clicks Sign In.
 *
 * The frontend pings this endpoint as soon as the login page mounts.
 * This converts the cold-start penalty from a login delay into a
 * background pre-warm that happens while the user types their credentials.
 *
 * Response time targets:
 *   - Warm server + warm DB:  < 50ms
 *   - Warm server + cold DB:  < 300ms
 *   - Cold server (Render):   1–10s (but this happens in the background)
 */
router.get('/', async (req, res) => {
  const t0 = Date.now();
  try {
    // Cheapest possible query — no table scan, no data transfer
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - t0;

    res.json({
      status: 'warm',
      serverUptime: Math.floor((Date.now() - startTime) / 1000),
      dbLatency,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // Still return 200 so the frontend doesn't treat this as a blocking error
    res.status(200).json({
      status: 'degraded',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
