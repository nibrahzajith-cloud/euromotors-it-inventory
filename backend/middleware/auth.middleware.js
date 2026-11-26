const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const {
  DEFAULT_ROLE_MODULES,
  resolveModuleAccess,
  resolveGranularPermissions,
  isAdminOrHeadOfIT,
} = require('../utils/rbac');
const { DEFAULT_PORTAL_CONFIG } = require('../utils/helpdeskSeed');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_euro_motors';

// Verify Token Middleware and hydrate live user permissions & employee linkage
exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // 1. Verified Employee Portal Session (scoped strictly to the verified Employee ID)
    if (decoded.tokenScope === 'PORTAL_EMPLOYEE') {
      if (!decoded.portalSessionId || !decoded.employeeId) {
        return res.status(401).json({ error: 'Invalid employee portal session' });
      }
      const [session, hdSettings] = await Promise.all([
        prisma.portalSession.findUnique({
          where: { id: decoded.portalSessionId },
          include: {
            employee: { include: { department: true, location: true } },
            user: true,
          },
        }),
        prisma.helpDeskSettings.findUnique({
          where: { id: 'global' },
          select: { portalConfig: true },
        }).catch(() => null),
      ]);

      if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
        return res.status(401).json({ error: 'Portal session has expired or was closed. Please verify your identity again.' });
      }
      if (!session.employee || session.employee.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Employee profile is inactive or disabled.' });
      }
      if (!session.user || session.user.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Employee support access is disabled.' });
      }

      const portalCfg = { ...DEFAULT_PORTAL_CONFIG, ...(hdSettings?.portalConfig || {}) };
      if (!portalCfg.enabled) {
        return res.status(403).json({ error: 'Employee Support Portal access is currently disabled.' });
      }
      const restrictedDepts = Array.isArray(portalCfg.restrictedDepartmentIds) ? portalCfg.restrictedDepartmentIds : [];
      const restrictedCodes = Array.isArray(portalCfg.restrictedEmployeeCodes)
        ? portalCfg.restrictedEmployeeCodes.map((c) => String(c).trim().toUpperCase())
        : [];
      if (
        (session.employee.departmentId && restrictedDepts.includes(session.employee.departmentId)) ||
        restrictedCodes.includes(String(session.employee.employeeCode || '').trim().toUpperCase())
      ) {
        return res.status(403).json({ error: 'Portal access is restricted for your employee profile. Contact IT Support.' });
      }

      // Enforce sliding inactivity timeout on shared/non-remembered sessions
      const idleMinutes = Math.max(5, Number(portalCfg.idleTimeoutMinutes) || 30);
      if (!session.rememberDevice) {
        const lastActiveMs = new Date(session.lastActivityAt).getTime();
        if (Date.now() - lastActiveMs > idleMinutes * 60 * 1000) {
          await prisma.portalSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          }).catch(() => {});
          return res.status(401).json({ error: 'Portal session timed out due to inactivity.' });
        }
      }

      // Throttled sliding lastActivityAt refresh (every 30s)
      if (Date.now() - new Date(session.lastActivityAt).getTime() > 30 * 1000) {
        prisma.portalSession.update({
          where: { id: session.id },
          data: { lastActivityAt: new Date() },
        }).catch(() => {});
      }

      req.user = {
        id: session.user.id,
        fullName: session.employee.fullName,
        email: session.employee.email || session.user.email,
        role: 'EMPLOYEE',
        status: session.user.status,
        employeeId: session.employee.id,
        modulePermissions: null,
        moduleAccess: { ...DEFAULT_ROLE_MODULES.EMPLOYEE },
        tokenScope: 'PORTAL_EMPLOYEE',
        isPortalSession: true,
        portalSessionId: session.id,
        rememberDevice: !!session.rememberDevice,
        idleTimeoutMinutes: idleMinutes,
      };
      return next();
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        employeeId: true,
        modulePermissions: true,
      },
    });

    if (!dbUser) {
      return res.status(401).json({ error: 'User account no longer exists' });
    }
    if (dbUser.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // 2. Portal Gateway Account (only allowed on identification/verification endpoints)
    if (decoded.tokenScope === 'PORTAL_GATEWAY' || dbUser.role === 'PORTAL_ACCESS') {
      const hdSettings = await prisma.helpDeskSettings.findUnique({
        where: { id: 'global' },
        select: { portalConfig: true },
      }).catch(() => null);
      const portalCfg = { ...DEFAULT_PORTAL_CONFIG, ...(hdSettings?.portalConfig || {}) };
      if (!portalCfg.enabled) {
        return res.status(403).json({ error: 'Employee Support Portal access is currently disabled.' });
      }
      req.user = {
        ...decoded,
        ...dbUser,
        role: 'PORTAL_ACCESS',
        tokenScope: 'PORTAL_GATEWAY',
        moduleAccess: resolveModuleAccess({ role: 'PORTAL_ACCESS' }),
      };
      return next();
    }

    req.user = {
      ...decoded,
      ...dbUser,
      moduleAccess: resolveModuleAccess(dbUser),
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Role Authorization Middleware
exports.authorize = (roles = []) => {
  const list = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !list.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};

// Module Access Middleware (enforces individual ON/OFF module toggles & role defaults)
exports.requireModule = (moduleKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (isAdminOrHeadOfIT(req.user.role)) {
      return next();
    }
    const access = req.user.moduleAccess || resolveModuleAccess(req.user);
    if (!access[moduleKey]) {
      return res.status(403).json({ error: `Forbidden: Module access disabled (${moduleKey})` });
    }
    next();
  };
};

exports.requireAnyModule = (moduleKeys = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (isAdminOrHeadOfIT(req.user.role)) {
      return next();
    }
    const access = req.user.moduleAccess || resolveModuleAccess(req.user);
    if (!moduleKeys.some((k) => !!access[k])) {
      return res.status(403).json({ error: 'Forbidden: Missing required module access' });
    }
    next();
  };
};

// Granular Permission Middleware
exports.requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized: User role not found' });
    }

    try {
      if (isAdminOrHeadOfIT(req.user.role)) {
        return next();
      }

      const rolePerm = await prisma.rolePermission.findUnique({
        where: { role: req.user.role },
      }).catch(() => null);

      const resolved = resolveGranularPermissions(req.user, rolePerm);

      if (!resolved[requiredPermission]) {
        return res.status(403).json({ error: `Forbidden: Missing permission ${requiredPermission}` });
      }

      next();
    } catch (err) {
      console.error('Permission Check Error:', err);
      return res.status(500).json({ error: 'Internal Server Error verifying permissions' });
    }
  };
};
