const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID, randomBytes } = require('crypto');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');
const { isITStaff, DEFAULT_ROLE_MODULES, resolveGranularPermissions } = require('../utils/rbac');
const { ensureHelpDeskSeeded, DEFAULT_PORTAL_CONFIG } = require('../utils/helpdeskSeed');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_euro_motors';

// In-memory sliding-window rate limiters for verification & directory search
const verifyAttempts = new Map();
const searchAttempts = new Map();

function checkRateLimit(store, key, maxAttempts, windowMs) {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  if (entry.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  entry.count += 1;
  return { allowed: true, remaining: maxAttempts - entry.count };
}

function getClientIp(req) {
  return req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() || req?.socket?.remoteAddress || req?.ip || 'unknown';
}

function normalizePhoneDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  // Normalize Sri Lankan country prefix (94xxxxxxxxx / 0xxxxxxxxx -> last 9 digits)
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
}

function isEmployeeRestricted(emp, portalCfg) {
  if (!emp) return true;
  if (emp.status !== 'ACTIVE') return true;
  const restrictedDepts = Array.isArray(portalCfg?.restrictedDepartmentIds) ? portalCfg.restrictedDepartmentIds : [];
  const restrictedCodes = Array.isArray(portalCfg?.restrictedEmployeeCodes)
    ? portalCfg.restrictedEmployeeCodes.map((c) => String(c).trim().toUpperCase())
    : [];
  if (emp.departmentId && restrictedDepts.includes(emp.departmentId)) return true;
  if (restrictedCodes.includes(String(emp.employeeCode || '').trim().toUpperCase())) return true;
  return false;
}

async function getPortalConfig() {
  await ensureHelpDeskSeeded();
  const settings = await prisma.helpDeskSettings.findUnique({
    where: { id: 'global' },
    select: { portalConfig: true },
  }).catch(() => null);
  return { ...DEFAULT_PORTAL_CONFIG, ...(settings?.portalConfig || {}) };
}

// -----------------------------------------------------------------------------
// PUBLIC PORTAL STATUS (non-sensitive capabilities only)
// -----------------------------------------------------------------------------
router.get('/status', async (req, res) => {
  try {
    const cfg = await getPortalConfig();
    res.json({
      enabled: !!cfg.enabled,
      portalEmail: cfg.portalEmail || DEFAULT_PORTAL_CONFIG.portalEmail,
      verificationMethod: cfg.verificationMethod || 'EMAIL_OR_PHONE',
      idleTimeoutMinutes: Number(cfg.idleTimeoutMinutes) || 30,
      allowRememberDevice: cfg.allowRememberDevice !== false,
      rememberDeviceDays: Number(cfg.rememberDeviceDays) || 7,
      minSearchChars: Number(cfg.minSearchChars) || 2,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// EMPLOYEE DIRECTORY SEARCH (requires Portal Gateway OR IT Staff)
// -----------------------------------------------------------------------------
router.get('/employees/search', authenticate, async (req, res) => {
  try {
    const isAllowed = req.user.tokenScope === 'PORTAL_GATEWAY' || req.user.tokenScope === 'PORTAL_EMPLOYEE' || isITStaff(req.user.role);
    if (!isAllowed) {
      return res.status(403).json({ error: 'Forbidden: Portal access required' });
    }

    const cfg = await getPortalConfig();
    if (!cfg.enabled && !isITStaff(req.user.role)) {
      return res.status(403).json({ error: 'Employee Support Portal is currently disabled' });
    }

    const ip = getClientIp(req);
    const rate = checkRateLimit(searchAttempts, `search:${ip}:${req.user.id}`, 60, 5 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many search requests. Please wait ${rate.retryAfterSec}s.` });
    }

    const q = String(req.query.q || '').trim();
    const minChars = Math.max(1, Number(cfg.minSearchChars) || 2);
    if (q.length < minChars) {
      return res.json({ employees: [], minSearchChars: minChars, queryTooShort: true });
    }

    const restrictedDepts = Array.isArray(cfg.restrictedDepartmentIds) ? cfg.restrictedDepartmentIds : [];
    const restrictedCodes = Array.isArray(cfg.restrictedEmployeeCodes)
      ? cfg.restrictedEmployeeCodes.map((c) => String(c).trim().toUpperCase())
      : [];

    const maxResults = Math.min(25, Math.max(5, Number(cfg.maxSearchResults) || 15));

    const candidates = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        ...(restrictedDepts.length > 0 ? { NOT: { departmentId: { in: restrictedDepts } } } : {}),
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { employeeCode: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        designation: true,
        email: true,
        phone: true,
        departmentId: true,
        department: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: [{ fullName: 'asc' }, { employeeCode: 'asc' }],
      take: maxResults + 10,
    });

    const filtered = candidates
      .filter((e) => !restrictedCodes.includes(String(e.employeeCode || '').trim().toUpperCase()))
      .slice(0, maxResults)
      .map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        designation: e.designation || null,
        departmentName: e.department?.name || null,
        locationName: e.location?.name || null,
        // Never leak raw email/phone in search payload
        hasEmail: !!(e.email && e.email.trim()),
        hasPhone: !!(e.phone && e.phone.trim()),
      }));

    res.json({
      employees: filtered,
      minSearchChars: minChars,
      verificationMethod: cfg.verificationMethod || 'EMAIL_OR_PHONE',
      queryTooShort: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// INDIVIDUAL EMPLOYEE IDENTITY VERIFICATION & SESSION ISSUANCE
// -----------------------------------------------------------------------------
router.post('/verify', authenticate, async (req, res) => {
  try {
    if (req.user.tokenScope !== 'PORTAL_GATEWAY' && req.user.tokenScope !== 'PORTAL_EMPLOYEE') {
      return res.status(403).json({ error: 'Forbidden: Common portal gateway authentication required' });
    }

    const cfg = await getPortalConfig();
    if (!cfg.enabled) {
      return res.status(403).json({ error: 'Employee Support Portal is currently disabled by IT Administration.' });
    }

    const { employeeId, verificationInput, rememberDevice = false } = req.body || {};
    if (!employeeId || !verificationInput || !String(verificationInput).trim()) {
      return res.status(400).json({ error: 'Please select an employee and enter your registered email address or mobile number.' });
    }

    const ip = getClientIp(req);
    const attemptKey = `verify:${ip}:${employeeId}`;
    const existingLimit = verifyAttempts.get(attemptKey);
    if (existingLimit && Date.now() - existingLimit.windowStart <= 15 * 60 * 1000 && existingLimit.count >= 5) {
      const waitSec = Math.ceil((existingLimit.windowStart + 15 * 60 * 1000 - Date.now()) / 1000);
      await logAudit({
        req,
        action: 'PORTAL_VERIFY_BLOCKED',
        module: 'PORTAL',
        entityType: 'EMPLOYEE',
        entityId: String(employeeId),
        status: 'FAILED',
        severity: 'WARNING',
        description: `Rate-limited employee portal verification attempt from ${ip}`,
      });
      return res.status(429).json({
        error: `Too many failed verification attempts. Please wait ${Math.ceil(waitSec / 60)} minute(s) or contact IT Support.`,
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: String(employeeId) },
      include: {
        department: true,
        location: true,
      },
    });

    if (!employee || isEmployeeRestricted(employee, cfg)) {
      checkRateLimit(verifyAttempts, attemptKey, 5, 15 * 60 * 1000);
      await logAudit({
        req,
        action: 'PORTAL_VERIFY_FAILED',
        module: 'PORTAL',
        entityType: 'EMPLOYEE',
        entityId: String(employeeId),
        status: 'FAILED',
        severity: 'WARNING',
        description: `Portal verification denied: inactive, restricted, or missing employee (${employeeId})`,
      });
      return res.status(403).json({ error: 'Selected employee profile is inactive or not authorized for self-service access.' });
    }

    const rawInput = String(verificationInput).trim();
    const inputLower = rawInput.toLowerCase();
    const inputPhoneNorm = normalizePhoneDigits(rawInput);

    const empEmail = (employee.email || '').trim().toLowerCase();
    const empPhoneNorm = normalizePhoneDigits(employee.phone);

    const method = cfg.verificationMethod || 'EMAIL_OR_PHONE';
    if (method === 'EMAIL_ONLY' && !empEmail) {
      return res.status(400).json({
        error: 'No corporate email address is registered for your profile. Please contact IT Support to submit a ticket on your behalf.',
        contactMissing: true,
      });
    }
    if (method === 'PHONE_ONLY' && !empPhoneNorm) {
      return res.status(400).json({
        error: 'No mobile number is registered for your profile. Please contact IT Support to submit a ticket on your behalf.',
        contactMissing: true,
      });
    }
    if (method === 'EMAIL_OR_PHONE' && !empEmail && !empPhoneNorm) {
      return res.status(400).json({
        error: 'No email address or mobile number is registered for your profile. Please contact IT Support to update your record or submit a request on your behalf.',
        contactMissing: true,
      });
    }

    let matchedMethod = null;
    if ((method === 'EMAIL_ONLY' || method === 'EMAIL_OR_PHONE') && empEmail && inputLower === empEmail) {
      matchedMethod = 'EMAIL';
    } else if (
      (method === 'PHONE_ONLY' || method === 'EMAIL_OR_PHONE') &&
      empPhoneNorm &&
      inputPhoneNorm &&
      inputPhoneNorm.length >= 9 &&
      inputPhoneNorm === empPhoneNorm
    ) {
      matchedMethod = 'PHONE';
    }

    if (!matchedMethod) {
      checkRateLimit(verifyAttempts, attemptKey, 5, 15 * 60 * 1000);
      await logAudit({
        req,
        employeeOverride: { id: employee.id, fullName: employee.fullName, departmentName: employee.department?.name },
        action: 'PORTAL_VERIFY_FAILED',
        module: 'PORTAL',
        entityType: 'EMPLOYEE',
        entityId: employee.id,
        entityCode: employee.employeeCode,
        status: 'FAILED',
        severity: 'WARNING',
        description: `Failed identity verification attempt for ${employee.employeeCode} (${employee.fullName})`,
      });
      return res.status(401).json({
        error: 'Verification failed. The email address or mobile number does not match our Employee Directory records.',
      });
    }

    // Success: clear rate limit counter for this key
    verifyAttempts.delete(attemptKey);

    // Find or auto-provision isolated background User linked strictly 1:1 to this Employee
    let linkedUser = await prisma.user.findUnique({ where: { employeeId: employee.id } });
    if (!linkedUser && empEmail) {
      const unlinkedByEmail = await prisma.user.findFirst({
        where: { email: { equals: employee.email.trim(), mode: 'insensitive' }, employeeId: null, role: 'EMPLOYEE' },
      });
      if (unlinkedByEmail) {
        linkedUser = await prisma.user.update({
          where: { id: unlinkedByEmail.id },
          data: { employeeId: employee.id, fullName: employee.fullName },
        });
      }
    }

    if (!linkedUser) {
      const randomSecret = randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomSecret, 8);
      let candidateEmail = empEmail ? employee.email.trim() : `${String(employee.employeeCode || employee.id).toLowerCase()}@portal.euromotors.local`;
      const emailTaken = await prisma.user.findUnique({ where: { email: candidateEmail } });
      if (emailTaken) {
        candidateEmail = `${String(employee.employeeCode || randomUUID().slice(0, 8)).toLowerCase()}.${randomUUID().slice(0, 4)}@portal.euromotors.local`;
      }

      linkedUser = await prisma.user.create({
        data: {
          fullName: employee.fullName,
          email: candidateEmail,
          passwordHash,
          role: 'EMPLOYEE',
          status: 'ACTIVE',
          mustChangePassword: false,
          employeeId: employee.id,
          modulePermissions: DEFAULT_ROLE_MODULES.EMPLOYEE,
        },
      });
    }

    if (linkedUser.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Employee support access is disabled. Contact IT Support.' });
    }

    const allowRemember = cfg.allowRememberDevice !== false;
    const isRemember = Boolean(rememberDevice) && allowRemember;
    const rememberDays = Math.min(30, Math.max(1, Number(cfg.rememberDeviceDays) || 7));
    const idleMinutes = Math.max(5, Number(cfg.idleTimeoutMinutes) || 30);

    const now = new Date();
    const expiresAt = isRemember
      ? new Date(now.getTime() + rememberDays * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const portalSession = await prisma.portalSession.create({
      data: {
        id: randomUUID(),
        employeeId: employee.id,
        userId: linkedUser.id,
        portalAccountId: req.user.id,
        verificationMethod: matchedMethod,
        rememberDevice: isRemember,
        expiresAt,
        lastActivityAt: now,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    const employeeToken = jwt.sign(
      {
        portalSessionId: portalSession.id,
        employeeId: employee.id,
        id: linkedUser.id,
        role: 'EMPLOYEE',
        tokenScope: 'PORTAL_EMPLOYEE',
      },
      JWT_SECRET,
      { expiresIn: isRemember ? `${rememberDays}d` : '8h' }
    );

    const rolePerm = await prisma.rolePermission.findUnique({ where: { role: 'EMPLOYEE' } }).catch(() => null);
    const permissions = resolveGranularPermissions(linkedUser, rolePerm);

    await logAudit({
      req,
      userOverride: { id: linkedUser.id, fullName: employee.fullName, email: employee.email || linkedUser.email, role: 'EMPLOYEE' },
      employeeOverride: { id: employee.id, fullName: employee.fullName, departmentName: employee.department?.name },
      action: 'PORTAL_VERIFY_SUCCESS',
      module: 'PORTAL',
      entityType: 'PORTAL_SESSION',
      entityId: portalSession.id,
      entityCode: employee.employeeCode,
      description: `Employee ${employee.fullName} (${employee.employeeCode}) verified via ${matchedMethod}${isRemember ? ' [Remember Device]' : ''}`,
    });

    res.json({
      message: 'Employee identity verified successfully',
      token: employeeToken,
      user: {
        id: linkedUser.id,
        fullName: employee.fullName,
        email: employee.email || linkedUser.email,
        role: 'EMPLOYEE',
        status: linkedUser.status,
        mustChangePassword: false,
        employeeId: employee.id,
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          email: employee.email,
          phone: employee.phone,
          designation: employee.designation,
          departmentId: employee.departmentId,
          departmentName: employee.department?.name || null,
          locationId: employee.locationId,
          locationName: employee.location?.name || null,
        },
        moduleAccess: { ...DEFAULT_ROLE_MODULES.EMPLOYEE },
        permissions,
        tokenScope: 'PORTAL_EMPLOYEE',
        isPortalSession: true,
        portalSessionId: portalSession.id,
        rememberDevice: isRemember,
        idleTimeoutMinutes: idleMinutes,
        landingRoute: '/helpdesk/employee',
      },
    });
  } catch (err) {
    console.error('[PORTAL VERIFY ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// SWITCH EMPLOYEE / REVOKE PORTAL SESSION
// -----------------------------------------------------------------------------
router.post('/switch', authenticate, async (req, res) => {
  try {
    if (req.user.portalSessionId) {
      await prisma.portalSession.update({
        where: { id: req.user.portalSessionId },
        data: { revokedAt: new Date() },
      }).catch(() => {});

      await logAudit({
        req,
        action: 'PORTAL_SWITCH_EMPLOYEE',
        module: 'PORTAL',
        entityType: 'PORTAL_SESSION',
        entityId: req.user.portalSessionId,
        entityCode: req.user.employeeId || null,
        description: `Employee ${req.user.fullName} switched employee / closed portal session`,
      });
    }
    res.json({ ok: true, message: 'Employee session cleared safely' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMINISTRATOR PORTAL CONFIGURATION & ACTIVITY LOGS
// -----------------------------------------------------------------------------
router.get('/admin/config', authenticate, authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    const cfg = await getPortalConfig();
    const [portalAccount, activeSessionsCount, totalActiveEmployees, unverifiableCount, departments] = await Promise.all([
      prisma.user.findFirst({
        where: { role: 'PORTAL_ACCESS' },
        select: { id: true, email: true, fullName: true, status: true, updatedAt: true, createdAt: true },
      }),
      prisma.portalSession.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.employee.count({
        where: {
          status: 'ACTIVE',
          AND: [
            { OR: [{ email: null }, { email: '' }] },
            { OR: [{ phone: null }, { phone: '' }] },
          ],
        },
      }),
      prisma.department.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    res.json({
      portalConfig: cfg,
      portalAccount,
      stats: {
        activeSessionsCount,
        totalActiveEmployees,
        unverifiableCount,
      },
      departments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/config', authenticate, authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    const current = await getPortalConfig();
    const incoming = req.body || {};

    const nextCfg = {
      ...current,
      enabled: incoming.enabled !== undefined ? Boolean(incoming.enabled) : current.enabled,
      portalEmail: incoming.portalEmail ? String(incoming.portalEmail).trim().toLowerCase() : current.portalEmail,
      verificationMethod: ['EMAIL_OR_PHONE', 'EMAIL_ONLY', 'PHONE_ONLY'].includes(incoming.verificationMethod)
        ? incoming.verificationMethod
        : current.verificationMethod,
      idleTimeoutMinutes: incoming.idleTimeoutMinutes !== undefined
        ? Math.min(480, Math.max(5, Number(incoming.idleTimeoutMinutes) || 30))
        : current.idleTimeoutMinutes,
      allowRememberDevice: incoming.allowRememberDevice !== undefined
        ? Boolean(incoming.allowRememberDevice)
        : current.allowRememberDevice,
      rememberDeviceDays: incoming.rememberDeviceDays !== undefined
        ? Math.min(30, Math.max(1, Number(incoming.rememberDeviceDays) || 7))
        : current.rememberDeviceDays,
      minSearchChars: incoming.minSearchChars !== undefined
        ? Math.min(5, Math.max(1, Number(incoming.minSearchChars) || 2))
        : current.minSearchChars,
      maxSearchResults: incoming.maxSearchResults !== undefined
        ? Math.min(25, Math.max(5, Number(incoming.maxSearchResults) || 15))
        : current.maxSearchResults,
      restrictedDepartmentIds: Array.isArray(incoming.restrictedDepartmentIds)
        ? incoming.restrictedDepartmentIds
        : current.restrictedDepartmentIds,
      restrictedEmployeeCodes: Array.isArray(incoming.restrictedEmployeeCodes)
        ? incoming.restrictedEmployeeCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
        : current.restrictedEmployeeCodes,
    };

    const portalUser = await prisma.user.findFirst({ where: { role: 'PORTAL_ACCESS' } });
    if (portalUser) {
      if (nextCfg.portalEmail && nextCfg.portalEmail !== portalUser.email) {
        const collision = await prisma.user.findUnique({ where: { email: nextCfg.portalEmail } });
        if (collision && collision.id !== portalUser.id) {
          return res.status(400).json({ error: `Email "${nextCfg.portalEmail}" is already used by another user.` });
        }
      }
      await prisma.user.update({
        where: { id: portalUser.id },
        data: {
          email: nextCfg.portalEmail,
          status: nextCfg.enabled ? 'ACTIVE' : 'INACTIVE',
        },
      });
    }

    await prisma.helpDeskSettings.update({
      where: { id: 'global' },
      data: { portalConfig: nextCfg },
    });

    await logAudit({
      req,
      action: 'UPDATE_PORTAL_CONFIG',
      module: 'PORTAL',
      entityType: 'HELP_DESK_SETTINGS',
      entityId: 'global',
      oldValue: current,
      newValue: nextCfg,
      severity: 'CRITICAL',
      description: `Updated Smart Employee Support Portal configuration`,
    });

    res.json({ portalConfig: nextCfg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/reset-password', authenticate, authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).trim().length < 6) {
      return res.status(400).json({ error: 'New portal password must be at least 6 characters long.' });
    }

    const portalUser = await prisma.user.findFirst({ where: { role: 'PORTAL_ACCESS' } });
    if (!portalUser) {
      return res.status(404).json({ error: 'Common portal account not found.' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword).trim(), 8);
    await prisma.user.update({
      where: { id: portalUser.id },
      data: { passwordHash, mustChangePassword: false },
    });

    await logAudit({
      req,
      action: 'PORTAL_PASSWORD_RESET',
      module: 'PORTAL',
      entityType: 'USER',
      entityId: portalUser.id,
      severity: 'CRITICAL',
      description: `Administrator updated password for common portal account (${portalUser.email})`,
    });

    res.json({ message: `Common portal password updated for ${portalUser.email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/logs', authenticate, authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    const [auditLogs, recentSessions] = await Promise.all([
      prisma.auditLog.findMany({
        where: { module: 'PORTAL' },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      prisma.portalSession.findMany({
        include: {
          employee: { select: { employeeCode: true, fullName: true, department: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    res.json({ auditLogs, recentSessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
