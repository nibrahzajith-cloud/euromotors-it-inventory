const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_euro_motors';

// Verify Token Middleware
exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, role, email
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
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

      const rolePerm = await prisma.rolePermission.findUnique({
        where: { role: req.user.role }
      });

      // Default fallback logic if DB is not populated yet
      const defaultPermissions = {
        IT_OFFICER: true,
        VIEWER: true
      };

      let hasPermission = false;

      if (rolePerm && rolePerm.permissions) {
        hasPermission = !!rolePerm.permissions[requiredPermission];
      } else {
        hasPermission = !!defaultPermissions[req.user.role];
      }

      if (!hasPermission) {
        return res.status(403).json({ error: `Forbidden: Missing permission ${requiredPermission}` });
      }

      next();
    } catch (err) {
      console.error('Permission Check Error:', err);
      return res.status(500).json({ error: 'Internal Server Error verifying permissions' });
    }
  };
};
