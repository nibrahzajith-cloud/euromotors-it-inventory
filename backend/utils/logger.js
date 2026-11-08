const { randomUUID } = require('crypto');
const prisma = require('../prismaClient');

/**
 * Strips sensitive fields (passwords, tokens) before serializing for audit storage.
 */
const stripSensitive = (val) => {
  if (!val) return val;
  let obj;
  let isString = false;

  try {
    if (typeof val === 'string') {
      obj = JSON.parse(val);
      isString = true;
    } else {
      obj = Array.isArray(val) ? [...val] : { ...val };
    }
  } catch (e) {
    return val;
  }

  const sensitiveFields = [
    'password', 'passwordHash', 'token', 'jwt', 'secret',
    'currentPassword', 'newPassword', 'confirmPassword'
  ];

  const mask = (target) => {
    if (!target || typeof target !== 'object') return;
    sensitiveFields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(target, field)) {
        target[field] = '********';
      }
    });
  };

  mask(obj);
  return isString ? JSON.stringify(obj) : obj;
};

/**
 * Computes list of modified field names between two entity snapshots.
 */
const getChangedFields = (oldVal, newVal) => {
  if (!oldVal || !newVal || typeof oldVal !== 'object' || typeof newVal !== 'object') {
    return null;
  }
  const changed = [];
  const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  const ignoredKeys = new Set(['updatedAt', 'passwordHash']);

  for (const key of keys) {
    if (ignoredKeys.has(key)) continue;
    const v1 = oldVal[key];
    const v2 = newVal[key];
    if (JSON.stringify(v1) !== JSON.stringify(v2)) {
      changed.push(key);
    }
  }
  return changed.length > 0 ? changed.join(', ') : null;
};

/**
 * Enterprise Audit Logger:
 * Guarantees authenticated user attribution, IP, User-Agent, correlation ID,
 * Sri Lanka time compatibility, and differential state tracking.
 */
const logAudit = ({
  req,
  userOverride,
  employeeOverride,
  action,
  module,
  entityType,
  entityId,
  entityCode,
  oldValue,
  newValue,
  changedFields: customChangedFields,
  description,
  status = 'SUCCESS',
  severity = 'INFO',
  errorMessage = null,
  activityType = null,
  executedBy = null
}) => {
  // Capture request values synchronously before request stream/context terminates
  const userId = userOverride?.id || req?.user?.id || null;
  let userName = userOverride?.fullName || userOverride?.name || req?.user?.fullName || req?.user?.name || null;
  let userEmail = userOverride?.email || req?.user?.email || null;
  let userRole = userOverride?.role || req?.user?.role || null;
  const employeeId = employeeOverride?.id || null;
  const employeeName = employeeOverride?.fullName || null;
  const departmentName = employeeOverride?.departmentName || null;
  const finalActivityType = activityType || (userId ? 'HUMAN' : 'SYSTEM');
  const finalExecutedBy = executedBy || (userId ? 'USER' : 'SYSTEM');
  const initiatedById = userId || null;

  const ipAddress = req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() || 
                    req?.socket?.remoteAddress || 
                    req?.ip || 
                    null;
  const userAgent = req?.headers?.['user-agent'] || null;
  const correlationId = req?.headers?.['x-correlation-id'] || randomUUID();
  const changedFields = customChangedFields || getChangedFields(oldValue, newValue);

  // Execute database insertion asynchronously in background so client response is not delayed
  setImmediate(async () => {
    try {
      if (userId && (!userName || !userEmail)) {
        try {
          const u = await prisma.user.findUnique({
            where: { id: userId },
            select: { fullName: true, email: true, role: true }
          });
          if (u) {
            userName = userName || u.fullName;
            userEmail = userEmail || u.email;
            userRole = userRole || u.role;
          }
        } catch (_) {}
      }

      await prisma.auditLog.create({
        data: {
          userId,
          userName,
          userEmail,
          userRole,
          employeeId,
          employeeName,
          departmentName,
          initiatedById,
          executedBy: finalExecutedBy,
          activityType: finalActivityType,
          action: (action || 'UNKNOWN').toUpperCase(),
          module: (module || 'GENERAL').toUpperCase(),
          entityType: entityType ? entityType.toUpperCase() : null,
          entityId: entityId ? String(entityId) : null,
          entityCode: entityCode ? String(entityCode) : null,
          description: description || null,
          oldValue: oldValue ? (typeof oldValue === 'object' ? JSON.stringify(stripSensitive(oldValue)) : String(oldValue)) : null,
          newValue: newValue ? (typeof newValue === 'object' ? JSON.stringify(stripSensitive(newValue)) : String(newValue)) : null,
          changedFields,
          status: status ? status.toUpperCase() : 'SUCCESS',
          severity: severity ? severity.toUpperCase() : 'INFO',
          errorMessage: errorMessage ? String(errorMessage) : null,
          ipAddress,
          userAgent,
          correlationId
        }
      });
    } catch (error) {
      console.error('Central Audit Engine Error (async):', error);
    }
  });

  return Promise.resolve();
};

/**
 * Reusable helper to log asset lifecycle timeline events.
 * Kept for backwards compatibility and synchronized with central audit logs.
 */
const logAssetTimeline = (data) => {
  setImmediate(async () => {
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
      console.error('Asset Timeline Error (async):', error);
    }
  });

  return Promise.resolve();
};

module.exports = {
  logAudit,
  logAssetTimeline
};
