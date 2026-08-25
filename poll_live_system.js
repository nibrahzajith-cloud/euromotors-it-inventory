async function pollLiveSystem() {
  console.log("=== POLLING DEPLOYMENT STATUS ===");
  const API_URL = 'https://euromotors-it-inventory.onrender.com/api';

  // Helper to make POST requests
  const post = async (url, body, token) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
      return { status: res.status, body: await res.text() };
    } catch(e) {
      return { status: 0, body: e.message };
    }
  };

  // Helper to make GET requests
  const get = async (url, token) => {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      return { status: res.status, body: await res.text() };
    } catch(e) {
      return { status: 0, body: e.message };
    }
  };

  let isDeployed = false;
  let adminToken = '';
  
  for(let i=0; i<30; i++) {
    console.log(`Polling attempt ${i+1}...`);
    const adminLogin = await post(`${API_URL}/auth/login`, { email: 'admin@euromotors.local', password: 'TestPassword123!' });
    if (adminLogin.status === 200) {
      adminToken = JSON.parse(adminLogin.body).token;
      const adminReports = await get(`${API_URL}/reports/assets`, adminToken);
      if (adminReports.status === 200) {
        console.log("Deployment is SUCCESSFUL! /api/reports/assets is online.");
        isDeployed = true;
        break;
      } else {
        console.log(`Backend is up but /api/reports/assets returned ${adminReports.status} (waiting for new version to deploy)`);
      }
    } else {
      console.log(`Login failed (status ${adminLogin.status}), waiting...`);
    }
    
    // Wait 10 seconds before next attempt
    await new Promise(r => setTimeout(r, 10000));
  }

  if (!isDeployed) {
    console.error("Deployment polling timed out!");
    return;
  }
  
  // RUN FULL TEST NOW
  console.log("\n=== RUNNING FULL VERIFICATION ===");
  
  // 1. Admin Test
  console.log("--- SYSTEM ADMIN ---");
  const adminReports = await get(`${API_URL}/reports/assets`, adminToken);
  console.log(`Admin /reports/assets: ${adminReports.status}`);
  if(adminReports.status === 200) {
    const assets = JSON.parse(adminReports.body);
    console.log(`Admin Data Count: ${assets.length} (Expected: 144)`);
    
    const uniqueIds = new Set(assets.map(a => a.assetCode));
    console.log(`Admin Unique Asset Codes: ${uniqueIds.size} (Expected: 144)`);
  }
  
  // 2. IT Officer Test
  console.log("\n--- IT OFFICER ---");
  const itoLogin = await post(`${API_URL}/auth/login`, { email: 'itofficer@euromotors.local', password: 'TestPassword123!' });
  if(itoLogin.status === 200) {
    const itoToken = JSON.parse(itoLogin.body).token;
    const itoReports = await get(`${API_URL}/reports/assets`, itoToken);
    console.log(`IT Officer /reports/assets: ${itoReports.status} (Expected: 403)`);
  } else {
    console.log(`IT Officer Login Failed: ${itoLogin.status}`);
  }

  // 3. Viewer Test
  console.log("\n--- VIEWER ---");
  const viewerLogin = await post(`${API_URL}/auth/login`, { email: 'viewer@euromotors.local', password: 'TestPassword123!' });
  if(viewerLogin.status === 200) {
    const viewerToken = JSON.parse(viewerLogin.body).token;
    const viewerReports = await get(`${API_URL}/reports/assets`, viewerToken);
    console.log(`Viewer /reports/assets: ${viewerReports.status} (Expected: 403)`);
  } else {
    console.log(`Viewer Login Failed: ${viewerLogin.status}`);
  }
  
  // 4. DB Storage Test
  console.log("\n--- DB METRICS ---");
  const dbStats = await get(`${API_URL}/uploads/storage/stats`, adminToken);
  console.log(`Storage Stats Endpoint: ${dbStats.status}`);
  
  console.log("\nVERIFICATION COMPLETE");
}

pollLiveSystem();
