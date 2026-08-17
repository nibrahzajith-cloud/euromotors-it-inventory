const generateNextCode = async (tx, modelName, fieldName, prefix, defaultStart = 0) => {
  // Lock the global settings row to serialize concurrent code generation requests
  // Caller must pass a transaction client (tx) to hold this lock through the INSERT
  await tx.$executeRaw`SELECT 1 FROM "SystemSettings" WHERE id = 'global' FOR UPDATE`;

  let query;
  if (modelName === 'employee') {
    query = tx.$queryRaw`SELECT "employeeCode" as code FROM "Employee" WHERE "employeeCode" LIKE ${prefix + '-%'}`;
  } else {
    query = tx.$queryRaw`SELECT "assetCode" as code FROM "Asset" WHERE "assetCode" LIKE ${prefix + '-%'}`;
  }
  
  const records = await query;
  let max = defaultStart;
  const regex = new RegExp(`^${prefix}-(\\d{9})$`);
  
  for (const record of records) {
    if (record.code) {
      const match = record.code.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        // Ignore previously generated random anomalies that are too high
        if (num > max && num < 100000) max = num;
      }
    }
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
  const settings = await tx.systemSettings.findUnique({ where: { id: 'global' } });
  const prefix = settings?.assetCodePrefix || 'AST';
  // Use 550 as default max so the next starts at 551 if no higher valid sequence exists
  return await generateNextCode(tx, 'asset', 'assetCode', prefix, 550);
};

module.exports = {
  generateEmployeeCode,
  generateAssetCode,
  generateNextCode
};
