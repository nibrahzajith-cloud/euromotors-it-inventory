const prisma = require('./prismaClient');

async function main() {
  console.log('Creating RolePermission table if not exists...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RolePermission" (
      "id" TEXT NOT NULL,
      "role" "Role" NOT NULL,
      "permissions" JSONB NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
    );
  `);
  
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_key" ON "RolePermission"("role");
  `);

  console.log('RolePermission table created or verified.');

  const adminPerms = {
    VIEW_ASSETS: true,
    CREATE_ASSETS: true,
    EDIT_ASSETS: true,
    DELETE_ASSETS: true,
    ASSIGN_ASSETS: true,
    MANAGE_MAINTENANCE: true,
    GENERATE_REPORTS: true,
    MANAGE_USERS: true,
    MANAGE_SETTINGS: true,
    VIEW_AUDIT_LOGS: true
  };

  const itOfficerPerms = {
    VIEW_ASSETS: true,
    CREATE_ASSETS: true,
    EDIT_ASSETS: true,
    DELETE_ASSETS: false,
    ASSIGN_ASSETS: true,
    MANAGE_MAINTENANCE: true,
    GENERATE_REPORTS: true,
    MANAGE_USERS: false,
    MANAGE_SETTINGS: false,
    VIEW_AUDIT_LOGS: true
  };

  const viewerPerms = {
    VIEW_ASSETS: true,
    CREATE_ASSETS: false,
    EDIT_ASSETS: false,
    DELETE_ASSETS: false,
    ASSIGN_ASSETS: false,
    MANAGE_MAINTENANCE: false,
    GENERATE_REPORTS: true,
    MANAGE_USERS: false,
    MANAGE_SETTINGS: false,
    VIEW_AUDIT_LOGS: false
  };

  const roles = [
    { role: 'ADMIN', permissions: adminPerms },
    { role: 'IT_OFFICER', permissions: itOfficerPerms },
    { role: 'VIEWER', permissions: viewerPerms }
  ];

  for (const r of roles) {
    const existing = await prisma.rolePermission.findUnique({ where: { role: r.role } });
    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          role: r.role,
          permissions: r.permissions
        }
      });
      console.log(`Inserted default permissions for role ${r.role}`);
    } else {
      console.log(`Role ${r.role} already exists with permissions:`, existing.permissions);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
