const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { logAudit } = require('../utils/logger');
const {
  resolveModuleAccess,
  resolveGranularPermissions,
  getDefaultLandingRoute,
} = require('../utils/rbac');
const { ensureHelpDeskSeeded, DEFAULT_PORTAL_CONFIG } = require('../utils/helpdeskSeed');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_euro_motors';
const IS_DEV = process.env.NODE_ENV !== 'production';
const BCRYPT_ROUNDS = 8;

async function buildAuthUserPayload(userRecord) {
  const rolePerm = await prisma.rolePermission.findUnique({
    where: { role: userRecord.role },
  }).catch(() => null);

  let employee = userRecord.employee || null;
  if (!employee && userRecord.employeeId) {
    employee = await prisma.employee.findUnique({
      where: { id: userRecord.employeeId },
      include: { department: true, location: true },
    }).catch(() => null);
  } else if (!employee && userRecord.email) {
    employee = await prisma.employee.findFirst({
      where: { email: { equals: userRecord.email, mode: 'insensitive' } },
      include: { department: true, location: true },
    }).catch(() => null);
  }

  const moduleAccess = resolveModuleAccess(userRecord);
  const permissions = resolveGranularPermissions(userRecord, rolePerm);
  const landingRoute = getDefaultLandingRoute({ ...userRecord, moduleAccess });

  return {
    id: userRecord.id,
    fullName: userRecord.fullName,
    email: userRecord.email,
    role: userRecord.role,
    status: userRecord.status,
    mustChangePassword: userRecord.mustChangePassword,
    employeeId: userRecord.employeeId || employee?.id || null,
    employee: employee ? {
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
    } : null,
    moduleAccess,
    modulePermissions: userRecord.modulePermissions || null,
    permissions,
    landingRoute,
  };
}

exports.register = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: role || 'EMPLOYEE',
      },
    });

    logAudit({
      req,
      userOverride: user,
      action: 'REGISTER',
      module: 'AUTH',
      entityType: 'USER',
      entityId: user.id,
      description: `New user registered: ${user.email} (${user.role})`,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    const userPayload = await buildAuthUserPayload(user);
    res.status(201).json({ message: 'User registered successfully', token, user: userPayload });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration', details: error.message });
  }
};

exports.login = async (req, res) => {
  const t0 = IS_DEV ? Date.now() : 0;
  try {
    await ensureHelpDeskSeeded();
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        fullName: true,
        mustChangePassword: true,
        employeeId: true,
        modulePermissions: true,
        employee: {
          include: { department: true, location: true },
        },
      },
    });

    if (IS_DEV) console.log(`[LOGIN] DB query: ${Date.now() - t0}ms`);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const t1 = IS_DEV ? Date.now() : 0;
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (IS_DEV) console.log(`[LOGIN] bcrypt compare: ${Date.now() - t1}ms`);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.role === 'PORTAL_ACCESS') {
      const hdSettings = await prisma.helpDeskSettings.findUnique({
        where: { id: 'global' },
        select: { portalConfig: true },
      }).catch(() => null);
      const portalCfg = { ...DEFAULT_PORTAL_CONFIG, ...(hdSettings?.portalConfig || {}) };
      if (!portalCfg.enabled) {
        return res.status(403).json({ error: 'Employee Support Portal access is currently disabled by IT Administration.' });
      }

      const gatewayToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: 'PORTAL_ACCESS',
          fullName: user.fullName,
          tokenScope: 'PORTAL_GATEWAY',
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      logAudit({
        req,
        userOverride: user,
        action: 'PORTAL_GATEWAY_LOGIN',
        module: 'PORTAL',
        entityType: 'USER',
        entityId: user.id,
        description: `Common portal account signed in: ${user.email}`,
      });

      const gatewayPayload = await buildAuthUserPayload(user);
      return res.json({
        message: 'Portal gateway authenticated',
        token: gatewayToken,
        user: {
          ...gatewayPayload,
          tokenScope: 'PORTAL_GATEWAY',
          landingRoute: '/portal/identify',
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    logAudit({
      req,
      userOverride: user,
      action: 'LOGIN',
      module: 'AUTH',
      entityType: 'USER',
      entityId: user.id,
      description: `User logged in: ${user.email}`,
    });

    const userPayload = await buildAuthUserPayload(user);

    res.json({ message: 'Login successful', token, user: userPayload });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    const isQuota = error.message && (error.message.includes('quota') || error.message.includes('53000'));
    const friendlyError = isQuota
      ? 'Database quota exceeded on Neon PostgreSQL. Please upgrade plan or reset quota in Neon console.'
      : 'Server error during login';
    res.status(500).json({ error: friendlyError, details: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    if (req.user.tokenScope === 'PORTAL_GATEWAY') {
      const portalUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          mustChangePassword: true,
          employeeId: true,
          modulePermissions: true,
        },
      });
      if (!portalUser) return res.status(404).json({ error: 'User not found' });
      const payload = await buildAuthUserPayload(portalUser);
      return res.json({
        ...payload,
        tokenScope: 'PORTAL_GATEWAY',
        landingRoute: '/portal/identify',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        mustChangePassword: true,
        employeeId: true,
        modulePermissions: true,
        employee: {
          include: { department: true, location: true },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userPayload = await buildAuthUserPayload(user);
    if (req.user.tokenScope === 'PORTAL_EMPLOYEE') {
      return res.json({
        ...userPayload,
        tokenScope: 'PORTAL_EMPLOYEE',
        isPortalSession: true,
        portalSessionId: req.user.portalSessionId,
        rememberDevice: !!req.user.rememberDevice,
        idleTimeoutMinutes: req.user.idleTimeoutMinutes || 30,
        landingRoute: '/helpdesk/employee',
      });
    }
    res.json(userPayload);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching user details' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) return res.status(400).json({ error: 'Incorrect current password' });

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash, mustChangePassword: false },
    });

    logAudit({
      req,
      action: 'CHANGE_PASSWORD',
      module: 'AUTH',
      entityType: 'USER',
      entityId: user.id,
      description: `User changed their own password: ${user.email}`,
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error changing password' });
  }
};
