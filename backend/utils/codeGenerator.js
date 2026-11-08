let cachedPrefix = 'AST';
let prefixCachedAt = 0;

const generateNextCode = async (tx, modelName, fieldName, prefix, defaultStart = 0) => {
  const tableName = modelName === 'employee' ? 'Employee' : 'Asset';
  let max = defaultStart;

  try {
    const rows = await tx.$queryRawUnsafe(`
      SELECT MAX(CAST(SUBSTRING("${fieldName}" FROM '[0-9]+') AS INTEGER)) as max_num
      FROM "${tableName}"
      WHERE "${fieldName}" ~ '^${prefix}-[0-9]+$'
        AND CAST(SUBSTRING("${fieldName}" FROM '[0-9]+') AS INTEGER) < 100000
    `);
    const val = rows?.[0]?.max_num;
    if (val !== null && val !== undefined && !isNaN(Number(val))) {
      max = Math.max(max, Number(val));
    }
  } catch (_) {
    // Resilient fallback: fetch only top 20 latest matching codes
    try {
      const fallbackRows = await tx.$queryRawUnsafe(`
        SELECT "${fieldName}" as code 
        FROM "${tableName}" 
        WHERE "${fieldName}" LIKE '${prefix}-%'
        ORDER BY "${fieldName}" DESC 
        LIMIT 20
      `);
      const regex = new RegExp(`^${prefix}-(\\d+)$`);
      for (const r of fallbackRows) {
        if (r.code) {
          const m = r.code.match(regex);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > max && num < 100000) max = num;
          }
        }
      }
    } catch (_) {}
  }

  const nextNumber = max + 1;
  const paddedNumber = nextNumber.toString().padStart(9, '0');
  return `${prefix}-${paddedNumber}`;
};

const generateEmployeeCode = async (tx) => {
  // Use 166 as default max so the next starts at 167 if no higher valid sequence exists
  return await generateNextCode(tx, 'employee', 'employeeCode', 'EMP', 166);
};

const generateAssetCode = async (tx) => {
  let prefix = 'AST';
  if (cachedPrefix && (Date.now() - prefixCachedAt) < 60000) {
    prefix = cachedPrefix;
  } else {
    try {
      const settings = await tx.systemSettings.findUnique({ where: { id: 'global' }, select: { assetCodePrefix: true } });
      prefix = settings?.assetCodePrefix || 'AST';
      cachedPrefix = prefix;
      prefixCachedAt = Date.now();
    } catch (_) {
      prefix = 'AST';
    }
  }
  return await generateNextCode(tx, 'asset', 'assetCode', prefix, 550);
};

module.exports = {
  generateEmployeeCode,
  generateAssetCode,
  generateNextCode
};
