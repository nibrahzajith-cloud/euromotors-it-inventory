# Euro Motors IT Inventory & Help Desk — Standardized Deployment & Rollback Runbook

## 1. Branch & Service Alignment (Mandatory)

To prevent frontend/backend version drift across Vercel and Render:

| Platform | Target Branch | Root Directory | Build Command | Start / Output |
|---|---|---|---|---|
| **GitHub** | `main` (production) | `/` | N/A | Source of truth |
| **Render Backend** (`euromotors-it-inventory`) | **`main`** (never leave on feature branch) | `backend` | `npm install && npm run build` | `npm start` (`node index.js`) |
| **Vercel Frontend** (`euromotors-it-inventory.vercel.app`) | **`main`** | `/` | `npm run build` | `dist/` (`VITE_API_URL` -> Render `/api`) |
| **Neon PostgreSQL** | Production DB | — | Managed via `backend/utils/migrations.js` (`IF NOT EXISTS`) | Zero destructive drops |

> **Root Lesson Learned (2026-11-26):** Leaving Render watching `feature/enterprise-asset-media-r2` while Vercel watched `main` caused Vercel to ship Help Desk & Valuation UI calling API endpoints that did not exist on the older Render build (`404`). Always verify Render **Settings → Branch = `main`** and **Auto-Deploy = Yes**.

---

## 2. Pre-Deployment Data Protection & Backup Checklist

1. Confirm all changes are tested on localhost against local dev PostgreSQL (`npm run build` passes + localhost smoke test passes).
2. Create a **Neon Branch / Snapshot checkpoint** in the Neon Console before touching production.
3. Never overwrite Neon with localhost data or run `prisma db push --force-reset` / `TRUNCATE` on production.
4. Verify all pending DB changes in `backend/utils/migrations.js` use strictly non-destructive, idempotent SQL (`IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, nullable columns).
5. Confirm R2 bucket credentials (`R2_*`) and `FRONTEND_URL` / `JWT_SECRET` / `DATABASE_URL` exist cleanly in Render Environment Variables.

---

## 3. Standardized Deployment Sequence

1. **Merge & Push to `main`** (only after testing locally):
   - Verify no `.env` or secret files are staged.
   - Push tested commit to `origin/main`.
2. **Deploy Backend First (Render)**:
   - Confirm Render starts building the **exact same `main` commit SHA**.
   - Inspect Render Startup Logs for:
     - `[STARTUP] Server running on port ...`
     - `[STARTUP] Database connection established.`
     - `[MIGRATION] Database migrations and performance indexing complete.`
3. **Verify Frontend Deployment (Vercel)**:
   - Confirm Vercel Production Deployment built the same `main` commit SHA.
4. **Run Automated Production Smoke Tests**:
   ```bash
   node scripts/verify_deployment.mjs --api=https://euromotors-it-inventory.onrender.com/api --web=https://euromotors-it-inventory.vercel.app
   ```
   All endpoints must return `PASS` (no `404`s on `/api/portal/status`, `/api/helpdesk/*`, `/api/notifications`, `/api/settings/version`, and `/api/health` must report `apiContract: "helpdesk-v1"`).
5. **Visual & Version Verification**:
   - Hard-refresh browser (`Ctrl+Shift+R`), sign in as `ADMIN` / `HEAD_OF_IT`.
   - Open **System Settings → System Version & Deployment Telemetry** and verify:
     - **Frontend & Backend Compatibility:** `Compatible & Synchronized`
     - Matching **Git Commit ID**, verified **Database Migration Version**, and `Production` environment.

---

## 4. Verified Rollback Procedure

1. **Application Rollback (Zero Data Loss):**
   - In **Render Dashboard → Deploys**, click **Rollback** on the previous healthy deploy (`07d88f2` / prior known-good SHA).
   - In **Vercel Dashboard → Deployments**, **Promote to Production** the matching previous frontend deployment.
   - Re-run `node scripts/verify_deployment.mjs` against the rolled-back services.
2. **Database Rollback (Only If Needed):**
   - Additive `IF NOT EXISTS` migrations do not break prior code versions.
   - If a schema revert is ever required, restore from the pre-deploy Neon snapshot/branch taken in Section 2 without touching R2 media files.
