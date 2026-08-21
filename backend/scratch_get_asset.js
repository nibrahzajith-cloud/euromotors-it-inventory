require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/euromotors_it_inventory?schema=public"
});
async function main() {
  const { rows } = await pool.query("SELECT * FROM \"Asset\" WHERE \"assetCode\" = 'AST-000000089'");
  console.log(JSON.stringify(rows[0], null, 2));
}
main().catch(console.error).finally(() => pool.end());
