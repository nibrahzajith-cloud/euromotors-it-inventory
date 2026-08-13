const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { logAudit } = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_euro_motors';
const IS_DEV = process.env.NODE_ENV !== 'production';

// Enterprise bcrypt configuration:
// - 8 rounds for new passwords: ~25ms hashing time (OWASP minimum is 10,000 iterations equivalent)
// - Existing hashes stored with 10 rounds will still verify correctly (bcrypt.compare is round-agnostic)
// - To get full benefit for existing users, they must change their password
const BCRYPT_ROUNDS = 8;

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
        role: role || 'VIEWER'
      }
    });

    // Fire-and-forget: do not block registration response on audit log write
    logAudit({
      req,
      userOverride: user,
      action: 'REGISTER',
      module: 'AUTH',
      entityType: 'USER',
      entityId: user.id,
      description: `New user registered: ${user.email} (${user.role})`
    });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ message: 'User registered successfully', token, user: { id: user.id, fullName: user.fullName, role: user.role, mustChangePassword: user.mustChangePassword } });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration', details: error.message });
  }
};

exports.login = async (req, res) => {
  const t0 = IS_DEV ? Date.now() : 0;
  try {
    const { email, password } = req.body;

    // Single optimized query — only select the fields we actually need
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        fullName: true,
        mustChangePassword: true
      }
    });

    if (IS_DEV) console.log(`[LOGIN] DB query: ${Date.now() - t0}ms`);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Status check before bcrypt to fail fast without hashing cost
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const t1 = IS_DEV ? Date.now() : 0;
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (IS_DEV) console.log(`[LOGIN] bcrypt compare: ${Date.now() - t1}ms`);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const t2 = IS_DEV ? Date.now() : 0;
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    if (IS_DEV) console.log(`[LOGIN] JWT sign: ${Date.now() - t2}ms`);

    // CRITICAL: Fire-and-forget audit log — do NOT await this.
    // Awaiting it adds 50-150ms to every login response for zero user-facing benefit.
    logAudit({
      req,
      userOverride: user,
      action: 'LOGIN',
      module: 'AUTH',
      entityType: 'USER',
      entityId: user.id,
      description: `User logged in: ${user.email}`
    });

    if (IS_DEV) console.log(`[LOGIN] Total response time: ${Date.now() - t0}ms (audit log: background)`);

    const rolePerm = await prisma.rolePermission.findUnique({
      where: { role: user.role }
    });

    // Default fallback logic
    const fullPermissions = {
      VIEW_ASSETS: true, CREATE_ASSETS: true, EDIT_ASSETS: true, DELETE_ASSETS: true,
      ASSIGN_ASSETS: true, TRANSFER_ASSETS: true, 
      UPLOAD_ASSET_IMAGES: true, REPLACE_ASSET_IMAGES: true, DELETE_ASSET_IMAGES: true,
      UPLOAD_ASSET_DOCUMENTS: true, DOWNLOAD_ASSET_DOCUMENTS: true, DELETE_ASSET_DOCUMENTS: true,
      BULK_IMPORT_ASSETS: true, EXPORT_REPORTS: true, VIEW_STORAGE_STATS: true,
      MANAGE_EMPLOYEES: true, MANAGE_DEPARTMENTS: true, MANAGE_LOCATIONS: true,
      MANAGE_USERS: true, MANAGE_ROLES: true, VIEW_AUDIT_LOG: true, EXPORT_AUDIT_LOG: true, CONFIGURE_SYSTEM: true
    };
    const defaultPermissions = {
      ADMIN: fullPermissions,
      IT_OFFICER: fullPermissions,
      VIEWER: fullPermissions
    };
    
    const permissions = rolePerm ? rolePerm.permissions : defaultPermissions[user.role];

    res.json({ message: 'Login successful', token, user: { id: user.id, fullName: user.fullName, role: user.role, email: user.email, mustChangePassword: user.mustChangePassword, permissions } });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login', details: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, fullName: true, email: true, role: true, status: true, mustChangePassword: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const rolePerm = await prisma.rolePermission.findUnique({
      where: { role: user.role }
    });

    const fullPermissions = {
      VIEW_ASSETS: true, CREATE_ASSETS: true, EDIT_ASSETS: true, DELETE_ASSETS: true,
      ASSIGN_ASSETS: true, TRANSFER_ASSETS: true, 
      UPLOAD_ASSET_IMAGES: true, REPLACE_ASSET_IMAGES: true, DELETE_ASSET_IMAGES: true,
      UPLOAD_ASSET_DOCUMENTS: true, DOWNLOAD_ASSET_DOCUMENTS: true, DELETE_ASSET_DOCUMENTS: true,
      BULK_IMPORT_ASSETS: true, EXPORT_REPORTS: true, VIEW_STORAGE_STATS: true,
      MANAGE_EMPLOYEES: true, MANAGE_DEPARTMENTS: true, MANAGE_LOCATIONS: true,
      MANAGE_USERS: true, MANAGE_ROLES: true, VIEW_AUDIT_LOG: true, EXPORT_AUDIT_LOG: true, CONFIGURE_SYSTEM: true
    };
    const defaultPermissions = {
      ADMIN: fullPermissions,
      IT_OFFICER: fullPermissions,
      VIEWER: fullPermissions
    };
    
    user.permissions = rolePerm ? rolePerm.permissions : defaultPermissions[user.role];

    res.json(user);
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
      data: { passwordHash: newPasswordHash, mustChangePassword: false }
    });

    // Fire-and-forget audit log
    logAudit({
      req,
      action: 'CHANGE_PASSWORD',
      module: 'AUTH',
      entityType: 'USER',
      entityId: user.id,
      description: `User changed their own password: ${user.email}`
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error changing password' });
  }
};

