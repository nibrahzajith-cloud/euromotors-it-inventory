const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_euro_motors';

// Verify Token Middleware
exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Ensure fullName and email are ALWAYS present in req.user
    if (!decoded.fullName || !decoded.email) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, fullName: true, email: true, role: true }
        });
        req.user = dbUser ? { ...decoded, ...dbUser } : decoded;
      } catch (dbErr) {
        req.user = decoded;
      }
    } else {
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Role Authorization Middleware
exports.authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
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
      // ADMIN always has full access — skip DB permission check
      if (req.user.role === 'ADMIN') {
        return next();
      }

      let rolePerm = null;
      try {
        rolePerm = await prisma.rolePermission.findUnique({
          where: { role: req.user.role }
        });
      } catch (dbErr) {
        console.warn('RolePermission lookup query failed, using safe fallback:', dbErr.message);
      }

      // Safe defaults: IT_OFFICER has access to all operational tasks
      const itOfficerAllowed = [
        'VIEW_ASSETS', 'CREATE_ASSETS', 'EDIT_ASSETS', 'ASSIGN_ASSETS',
        'MANAGE_MAINTENANCE', 'GENERATE_REPORTS', 'VIEW_AUDIT_LOGS'
      ];
      const viewerAllowed = ['VIEW_ASSETS', 'GENERATE_REPORTS'];

      let hasPermission = false;

      if (rolePerm && rolePerm.permissions && typeof rolePerm.permissions === 'object') {
        hasPermission = !!rolePerm.permissions[requiredPermission];
      } else {
        if (req.user.role === 'IT_OFFICER') {
          hasPermission = itOfficerAllowed.includes(requiredPermission);
        } else if (req.user.role === 'VIEWER') {
          hasPermission = viewerAllowed.includes(requiredPermission);
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ error: `Forbidden: Missing permission ${requiredPermission}` });
      }

      next();
    } catch (err) {
      console.error('Permission Check Error:', err);
      if (req.user.role === 'ADMIN' || req.user.role === 'IT_OFFICER') {
        return next();
      }
      return res.status(500).json({ error: 'Internal Server Error verifying permissions' });
    }
  };
};
