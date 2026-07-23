const generateNextCode = async (prisma, modelName, fieldName, prefix, suffix) => {
  const lastRecord = await prisma[modelName].findFirst({
    where: {
      [fieldName]: {
        startsWith: `${prefix}-`,
        endsWith: `-${suffix}`
      }
    },
    orderBy: {
      [fieldName]: 'desc'
    }
  });

  let nextNumber = 1;
  if (lastRecord) {
    const code = lastRecord[fieldName];
    // Attempt to extract the middle number part
    const regex = new RegExp(`^${prefix}-(\\d+)-${suffix}$`);
    const match = code.match(regex);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    } else {
      // Fallback
      const count = await prisma[modelName].count();
      nextNumber = count + 1;
    }
  }

  const paddedNumber = nextNumber.toString().padStart(5, '0');
  return `${prefix}-${paddedNumber}-${suffix}`;
};

const generateEmployeeCode = async (prisma) => {
  return await generateNextCode(prisma, 'employee', 'employeeCode', 'EMP', '001');
};

const generateAssetCode = async (prisma) => {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const prefix = settings?.assetCodePrefix || 'AST';
  return await generateNextCode(prisma, 'asset', 'assetCode', prefix, '001');
};

module.exports = {
  generateEmployeeCode,
  generateAssetCode
};
