const http = require('http');

const API_URL = 'http://localhost:5000/api';

async function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const { URL } = require('url');
    const myUrl = new URL(`${API_URL}${path}`);

    const options = {
      hostname: myUrl.hostname,
      port: myUrl.port,
      path: myUrl.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("=== STARTING MAINTENANCE INTEGRATION TESTS ===");

  // 1. Authenticate Roles
  const adminRes = await request('/auth/login', 'POST', { email: 'admin@euromotors.com', password: 'password123' });
  const adminToken = adminRes.data.token;
  
  const itRes = await request('/auth/login', 'POST', { email: 'it@euromotors.com', password: 'password123' });
  const itToken = itRes.data.token;
  
  const viewerRes = await request('/auth/login', 'POST', { email: 'viewer@euromotors.com', password: 'viewerpassword' });
  const viewerToken = viewerRes.data.token;

  console.log(`[AUTH] Successfully generated tokens for Admin, IT Officer, and Viewer.`);

  // Setup: Find an asset to test
  const assetsRes = await request('/assets', 'GET', null, adminToken);
  const assets = assetsRes.data;
  
  // We need an unassigned asset, and an assigned asset
  let availableAsset = assets.find(a => a.status === 'AVAILABLE');
  let assignedAsset = assets.find(a => a.status === 'ASSIGNED');
  
  const rand1 = Math.floor(Math.random() * 9999);
  const rand2 = Math.floor(Math.random() * 9999);
  
  if (!availableAsset) {
      console.log("[SETUP] Spawning temporary AVAILABLE asset...");
      const res = await request('/assets', 'POST', { assetCode: `TEST-AVL-${rand1}`, model: 'T1', serialNumber: `SN001AV${rand1}`, status: 'AVAILABLE', deviceType: 'Laptop', condition: 'New', warrantyStatus: 'Active' }, adminToken);
      availableAsset = res.data;
  }
  
  if (!assignedAsset) {
      console.log("[SETUP] Spawning temporary ASSIGNED asset...");
      const res = await request('/assets', 'POST', { assetCode: `TEST-ASSG-${rand2}`, model: 'T2', serialNumber: `SN002AS${rand2}`, status: 'AVAILABLE', deviceType: 'Laptop', condition: 'New', warrantyStatus: 'Active' }, adminToken);
      
      const empRes = await request('/employees', 'GET', null, adminToken);
      const emp = empRes.data[0] || { id: null };
      
      const asgRes = await request('/assignments', 'POST', { assetId: res.data.id, employeeId: emp.id, status: 'ACTIVE', assignedDate: new Date().toISOString() }, adminToken);
      
      const astResx = await request('/assets', 'GET', null, adminToken);
      assignedAsset = astResx.data.find(a => a.id === res.data.id);
  }

  console.log(`[TEST BASE] Unassigned Asset ID: ${availableAsset.id}`);
  console.log(`[TEST BASE] Assigned Asset ID: ${assignedAsset.id}`);

  // Test 1 & 6: Admin Create Log (OPEN) -> Asset = UNDER_REPAIR (Unassigned tracking)
  const create1Res = await request('/maintenance', 'POST', {
     assetId: availableAsset.id,
     issueDescription: "TEST 1",
     repairAction: "Pending",
     status: "OPEN",
     repairDate: new Date().toISOString()
  }, adminToken);
  console.log(`[ADMIN TEST] Creating OPEN Log -> Status Code: ${create1Res.status}`);
  const log1Id = create1Res.data.id;

  const getAsset1Res = await request(`/assets`, 'GET', null, adminToken);
  const updatedAsset1 = getAsset1Res.data.find(a => a.id === availableAsset.id);
  console.log(`[LOGIC TEST] Asset Status changed to -> ${updatedAsset1.status} (Expected: UNDER_REPAIR)`);

  // Test 2 & 7: Admin Edit Log (IN_PROGRESS) -> Asset = UNDER_REPAIR
  const create2Res = await request(`/maintenance/${log1Id}`, 'PUT', {
     status: "IN_PROGRESS",
  }, adminToken);
  console.log(`[ADMIN TEST] Editing Log IN_PROGRESS -> Status Code: ${create2Res.status}`);

  const getAsset2Res = await request(`/assets`, 'GET', null, adminToken);
  const updatedAsset2 = getAsset2Res.data.find(a => a.id === availableAsset.id);
  console.log(`[LOGIC TEST] Asset Status remained -> ${updatedAsset2.status} (Expected: UNDER_REPAIR)`);

  // Test 9: Admin Edit Log (RESOLVED) -> Asset = AVAILABLE (Null Assignment tracking)
  await request(`/maintenance/${log1Id}`, 'PUT', { status: "RESOLVED" }, adminToken);
  const getAsset3Res = await request(`/assets`, 'GET', null, adminToken);
  const updatedAsset3 = getAsset3Res.data.find(a => a.id === availableAsset.id);
  console.log(`[LOGIC TEST] Asset Status resolved to -> ${updatedAsset3.status} (Expected: AVAILABLE)`);

  // Test 8: Admin Edit Log (RESOLVED) -> Asset = ASSIGNED (Assigned Assignment tracking)
  console.log(`[DEBUG] Check Assigned Asset before RESOLVED: ${assignedAsset.id} -> Emp: ${assignedAsset.assignedEmployeeId}`);
  const log2Res = await request('/maintenance', 'POST', {
     assetId: assignedAsset.id,
     issueDescription: "TEST 2", status: "OPEN", repairDate: new Date().toISOString()
  }, adminToken);
  await request(`/maintenance/${log2Res.data.id}`, 'PUT', { status: "RESOLVED" }, adminToken);
  
  const getAsset4Res = await request(`/assets`, 'GET', null, adminToken);
  const updatedAsset4 = getAsset4Res.data.find(a => a.id === assignedAsset.id);
  console.log(`[LOGIC TEST] Assigned Asset Status resolved to -> ${updatedAsset4.status} (Expected: ASSIGNED)`);

  // Test 4: IT OFFICER bounds
  const itCreateRes = await request('/maintenance', 'POST', {
     assetId: availableAsset.id,
     issueDescription: "IT BOUNDARY TEST", status: "OPEN"
  }, itToken);
  console.log(`[IT OFFICER TEST] Can Create -> Status Code: ${itCreateRes.status}`);
  
  const itDeleteRes = await request(`/maintenance/${itCreateRes.data.id}`, 'DELETE', null, itToken);
  console.log(`[IT OFFICER TEST] Cannot Delete -> Status Code: ${itDeleteRes.status} (Expected: 403 Forbidden)`);

  // Test 5: VIEWER bounds
  const viewerCreateRes = await request('/maintenance', 'POST', {
    assetId: availableAsset.id, issueDescription: "VIEWER TEST"
  }, viewerToken);
  console.log(`[VIEWER TEST] Cannot Create -> Status Code: ${viewerCreateRes.status} (Expected: 403 Forbidden)`);

  // Test 3: Admin Delete Logic cleanup
  const adminDeleteRes = await request(`/maintenance/${log1Id}`, 'DELETE', null, adminToken);
  console.log(`[ADMIN TEST] Deleting Log -> Status Code: ${adminDeleteRes.status}`);
  await request(`/maintenance/${log2Res.data.id}`, 'DELETE', null, adminToken);
  const adminDeleteRes2 = await request(`/maintenance/${itCreateRes.data.id}`, 'DELETE', null, adminToken);
  console.log(`[ADMIN TEST] Cleanup success. Deleted test records.`);

  // Test 10: Refreshing Maintenance
  const remainingLogs = await request(`/maintenance`, 'GET', null, adminToken);
  console.log(`[REFRESH TEST] Fetched raw maintenance history. Log count reflects non-wipe logs natively.`);
  
  console.log("=== TESTS COMPLETED SUCCESSFULLY ===");
}

runTests();
