require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/euromotors_it_inventory?schema=public"
});

async function main() {
  const client = await pool.connect();
  
  try {
    // 1. Identify the two assets
    const { rows: assets } = await client.query(
      `SELECT * FROM "Asset" WHERE "assetCode" IN ('AST-000000087', 'AST-000000089')`
    );

    const asset87 = assets.find(a => a.assetCode === 'AST-000000087');
    const asset89 = assets.find(a => a.assetCode === 'AST-000000089');

    if (!asset87 || !asset89) {
      throw new Error("Could not find both assets.");
    }

    console.log("=== Current Mapping ===");
    console.log(`AST-000000087 is ${asset87.deviceType} (${asset87.brand || 'No Brand'} ${asset87.model || ''}) - SN: ${asset87.serialNumber}`);
    console.log(`AST-000000089 is ${asset89.deviceType} (${asset89.brand || 'No Brand'} ${asset89.model || ''}) - SN: ${asset89.serialNumber}`);

    const laptop = asset87.deviceType === 'Laptop' ? asset87 : (asset89.deviceType === 'Laptop' ? asset89 : null);
    const mouse = asset87.deviceType === 'Mouse' ? asset87 : (asset89.deviceType === 'Mouse' ? asset89 : null);

    if (!laptop || !mouse) {
       console.log(asset87, asset89);
       throw new Error("Could not verify which is Laptop and which is Mouse based on deviceType.");
    }

    // 2. Perform the swap transaction safely
    console.log("\nStarting swap transaction...");
    await client.query('BEGIN');

    // Rename AST-000000087 to a temporary code to free up AST-000000087
    await client.query(`UPDATE "Asset" SET "assetCode" = 'AST-TEMP' WHERE id = $1`, [asset87.id]);
    
    // Rename AST-000000089 to AST-000000087
    await client.query(`UPDATE "Asset" SET "assetCode" = 'AST-000000087' WHERE id = $1`, [asset89.id]);

    // Rename temporary code to AST-000000089
    await client.query(`UPDATE "Asset" SET "assetCode" = 'AST-000000089' WHERE id = $1`, [asset87.id]);

    // Update related tables: AssetTimeline
    await client.query(`UPDATE "AssetTimeline" SET "assetCode" = 'AST-000000089' WHERE "assetId" = $1`, [asset87.id]);
    await client.query(`UPDATE "AssetTimeline" SET "assetCode" = 'AST-000000087' WHERE "assetId" = $1`, [asset89.id]);

    // Update related tables: AuditLog
    await client.query(`UPDATE "AuditLog" SET "entityCode" = 'AST-000000089' WHERE "entityId" = $1 AND "entityType" = 'ASSET'`, [asset87.id]);
    await client.query(`UPDATE "AuditLog" SET "entityCode" = 'AST-000000087' WHERE "entityId" = $1 AND "entityType" = 'ASSET'`, [asset89.id]);

    // Check if qrcode url has the old code and update it if necessary
    if (asset87.qrCodeUrl && asset87.qrCodeUrl.includes('AST-000000087')) {
       const newUrl = asset87.qrCodeUrl.replace('AST-000000087', 'AST-000000089');
       await client.query(`UPDATE "Asset" SET "qrCodeUrl" = $1 WHERE id = $2`, [newUrl, asset87.id]);
    }
    if (asset89.qrCodeUrl && asset89.qrCodeUrl.includes('AST-000000089')) {
       const newUrl = asset89.qrCodeUrl.replace('AST-000000089', 'AST-000000087');
       await client.query(`UPDATE "Asset" SET "qrCodeUrl" = $1 WHERE id = $2`, [newUrl, asset89.id]);
    }

    // Add Audit Log for this operation
    const auditQuery = `
      INSERT INTO "AuditLog" ("id", "action", "module", "description", "createdAt")
      VALUES (gen_random_uuid(), 'SWAP_ASSET_CODES', 'ASSET', 'Swapped asset codes between AST-000000087 (Laptop) and AST-000000089 (Mouse)', NOW())
    `;
    await client.query(auditQuery);

    await client.query('COMMIT');
    console.log("Transaction committed successfully.");

    // 3. Verify
    const { rows: verifyRows } = await client.query(
      `SELECT * FROM "Asset" WHERE "assetCode" IN ('AST-000000087', 'AST-000000089')`
    );

    const v87 = verifyRows.find(a => a.assetCode === 'AST-000000087');
    const v89 = verifyRows.find(a => a.assetCode === 'AST-000000089');

    console.log("\n=== New Mapping ===");
    console.log(`AST-000000087 is ${v87.deviceType} (${v87.brand || 'No Brand'} ${v87.model || ''}) - SN: ${v87.serialNumber}`);
    console.log(`AST-000000089 is ${v89.deviceType} (${v89.brand || 'No Brand'} ${v89.model || ''}) - SN: ${v89.serialNumber}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Transaction failed, rolling back.");
    console.error(err);
  } finally {
    client.release();
  }
}

main().catch(console.error).finally(() => pool.end());
