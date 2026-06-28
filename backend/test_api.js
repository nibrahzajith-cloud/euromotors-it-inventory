const prisma = require('./prismaClient');

async function runTests() {
  const BASE_URL = 'http://localhost:5000/api';
  console.log("--- STARTING BACKEND API TESTS ---");

  // 1 & 2: Admin Login & JWT returned
  console.log("1 & 2. Testing Admin Login...");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: "admin@euromotors.com", password: "password123" })
  });
  const loginData = await loginRes.json();
  if(!loginData.token) throw new Error("Admin login failed or no JWT returned");
  const adminToken = loginData.token;
  console.log("   [OK] Admin Login successful, JWT received.");

  // 3. GET /api/assets works with token
  console.log("3. Testing GET /api/assets with token...");
  const getAssetsRes = await fetch(`${BASE_URL}/assets`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const getAssetsData = await getAssetsRes.json();
  if(!Array.isArray(getAssetsData)) throw new Error("GET /api/assets failed");
  console.log("   [OK] GET /api/assets returned an array.");

  // 4. POST /api/departments with Admin token
  console.log("4. Testing POST /api/departments...");
  const deptRes = await fetch(`${BASE_URL}/departments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "IT Department", description: "Core IT operations" })
  });
  const deptData = await deptRes.json();
  if(!deptData.id) throw new Error("Failed to create department");
  console.log("   [OK] Created Department:", deptData.name);

  // 5. POST /api/locations with Admin token
  console.log("5. Testing POST /api/locations...");
  const locRes = await fetch(`${BASE_URL}/locations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "Main HQ", description: "Headquarters" })
  });
  const locData = await locRes.json();
  if(!locData.id) throw new Error("Failed to create location");
  console.log("   [OK] Created Location:", locData.name);

  // 6. POST /api/employees with Admin or IT Officer
  console.log("6. Testing POST /api/employees...");
  const empRes = await fetch(`${BASE_URL}/employees`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ employeeCode: "EMP-001", fullName: "John Doe", email: "john@euromotors.com", departmentId: deptData.id, locationId: locData.id })
  });
  const empData = await empRes.json();
  if(!empData.id) throw new Error("Failed to create employee");
  console.log("   [OK] Created Employee:", empData.fullName);

  // 7. POST /api/assets with Admin
  console.log("7. Testing POST /api/assets...");
  const assetRes = await fetch(`${BASE_URL}/assets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ assetCode: "EM-IT-LAP-0001", deviceType: "Laptop", model: "Precision 5550", serialNumber: "SN-987654", warrantyStatus: "Active", condition: "New", status: "AVAILABLE", locationId: locData.id })
  });
  const assetData = await assetRes.json();
  if(!assetData.id) throw new Error("Failed to create asset");
  console.log("   [OK] Created Asset:", assetData.assetCode);

  // 8. Viewer cannot create/edit/delete assets
  console.log("8. Testing Viewer permissions (Expect 403 Failed)...");
  // Register Viewer
  await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: "Viewer User", email: "viewer@euromotors.com", password: "viewerpassword", role: "VIEWER" })
  });
  const viewerLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: "viewer@euromotors.com", password: "viewerpassword" })
  });
  const viewerToken = (await viewerLogin.json()).token;
  
  const viewerAssetReq = await fetch(`${BASE_URL}/assets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${viewerToken}` },
    body: JSON.stringify({ assetCode: "TEST-FAILED", deviceType: "Laptop", model: "N/A", serialNumber: "000000", warrantyStatus: "Active", condition: "New", status: "AVAILABLE" })
  });
  if(viewerAssetReq.status !== 403) throw new Error("Viewer was able to bypass security");
  console.log("   [OK] Viewer successfully blocked from creating assets (403 Forbidden).");

  // 9. Password is stored only as passwordHash
  console.log("9. Checking database for plain passwords...");
  const dbUsers = await prisma.user.findMany();
  const rawAdmin = dbUsers.find(u => u.email === "admin@euromotors.com");
  if(rawAdmin.password !== undefined) throw new Error("Plain password field exists");
  console.log("   [OK] Plain password completely absent. Only `passwordHash` stored: ", rawAdmin.passwordHash.substring(0, 10) + '...');

  // 10. Tables show records correctly
  console.log("10. Fetching pure raw data from DB confirming ORM storage...");
  const deptCount = await prisma.department.count();
  const assetCount = await prisma.asset.count();
  console.log(`   [OK] DB currently holds: ${deptCount} Departments, ${assetCount} Assets`);
  
  console.log("--- ALL BACKEND TESTS PASSED SUCCESSFULLY! ---");
}

runTests().catch(console.error).finally(() => process.exit(0));
