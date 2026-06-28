const prisma = require('../prismaClient');

/**
 * Reusable helper to log system-wide audit actions.
 * Ensures sensitive data is masked.
 */
const logAudit = async ({
  req,
  userOverride,
  action,
  module,
  entityType,
  entityId,
  entityCode,
  oldValue,
  newValue,
  description
}) => {
  try {
    // Extract user info from req or use override (useful for login/registration/admin actions)
    const userId = userOverride?.id || req?.user?.id || null;
    const userName = userOverride?.fullName || req?.user?.fullName || null;
    const userRole = userOverride?.role || req?.user?.role || null;
    const ipAddress = req?.ip || req?.headers['x-forwarded-for'] || null;

    // Helper to strip sensitive fields from stringified JSON or objects
    const stripSensitive = (val) => {
      if (!val) return val;
      let obj;
      let isString = false;
      
      try {
        if (typeof val === 'string') {
          obj = JSON.parse(val);
          isString = true;
        } else {
          obj = { ...val };
        }
      } catch (e) {
        return val;
      }
      
      const sensitiveFields = ['password', 'passwordHash', 'token', 'currentPassword', 'newPassword', 'confirmPassword'];
      
      const mask = (target) => {
        if (!target || typeof target !== 'object') return;
        sensitiveFields.forEach(field => {
          if (Object.prototype.hasOwnProperty.call(target, field)) {
            target[field] = '********';
          }
        });
        // Recursively check for nested objects if necessary, 
        // but for these models shallow check is usually enough.
      };

      mask(obj);
      
      return isString ? JSON.stringify(obj) : obj;
    };

    await prisma.auditLog.create({
      data: {
        userId,
        userName,
        userRole,
        action,
        module,
        entityType,
        entityId,
        entityCode,
        oldValue: typeof oldValue === 'object' ? JSON.stringify(stripSensitive(oldValue)) : stripSensitive(oldValue),
        newValue: typeof newValue === 'object' ? JSON.stringify(stripSensitive(newValue)) : stripSensitive(newValue),
        description,
        ipAddress
      }
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
    // Silent fail to ensure main operation continues
  }
};

/**
 * Reusable helper to log asset lifecycle timeline events.
 */
const logAssetTimeline = async (data) => {
  try {
    await prisma.assetTimeline.create({
      data: {
        assetId: data.assetId,
        assetCode: data.assetCode,
        eventType: data.eventType,
        title: data.title,
        description: data.description,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        departmentId: data.departmentId,
        departmentName: data.departmentName,
        locationId: data.locationId,
        locationName: data.locationName,
        performedById: data.performedById,
        performedByName: data.performedByName
      }
    });
  } catch (error) {
    console.error('Asset Timeline Error:', error);
    // Silent fail
  }
};

module.exports = {
  logAudit,
  logAssetTimeline
};
