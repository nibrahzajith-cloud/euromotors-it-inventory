const generateNextCode = async (prisma, modelName, fieldName, prefix) => {
  const lastRecord = await prisma[modelName].findFirst({
    where: {
      [fieldName]: {
        startsWith: `${prefix}-`
      }
    },
    orderBy: {
      [fieldName]: 'desc'
    }
  });

  let nextNumber = 1;
  if (lastRecord) {
    const code = lastRecord[fieldName];
    // Attempt to extract the number part
    const regex = new RegExp(`^${prefix}-(\\d{9})$`);
    const match = code.match(regex);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    } else {
      // Fallback
      const count = await prisma[modelName].count();
      nextNumber = count + 1;
    }
  }

  const paddedNumber = nextNumber.toString().padStart(9, '0');
  return `${prefix}-${paddedNumber}`;
};

const generateEmployeeCode = async (prisma) => {
  return await generateNextCode(prisma, 'employee', 'employeeCode', 'EMP');
};

const generateAssetCode = async (prisma) => {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const prefix = settings?.assetCodePrefix || 'AST';
  return await generateNextCode(prisma, 'asset', 'assetCode', prefix);
};

module.exports = {
  generateEmployeeCode,
  generateAssetCode
};
