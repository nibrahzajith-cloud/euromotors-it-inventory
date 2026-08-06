const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/euromotors_it_inventory?schema=public";

// Tuned connection pool:
// - keepAlive: prevents Neon from silently dropping idle connections
// - max: caps concurrent connections (Neon free tier allows ~5-10)
// - idleTimeoutMillis: recycle connections after 30s idle (reduces Neon cost)
// - connectionTimeoutMillis: fail fast rather than hanging the request
const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

const adapter = new PrismaPg(pool);

// Singleton guard: prevents multiple PrismaClient instances during nodemon/HMR restarts.
// Without this, each reload leaks a new pool connection set to Neon.
let prisma;

if (global.__prismaClient) {
  prisma = global.__prismaClient;
} else {
  prisma = new PrismaClient({ adapter });
  global.__prismaClient = prisma;
}

module.exports = prisma;
