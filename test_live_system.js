async function testLiveSystem() {
  console.log("=== LIVE SYSTEM TEST ===");
  
  // 1. Fetch frontend index.html to find the JS bundle
  console.log("Fetching Vercel frontend...");
  const htmlRes = await fetch('https://euromotors-it-inventory.vercel.app');
  const html = await htmlRes.text();

  const scriptMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!scriptMatch) {
    console.error("Could not find JS bundle in HTML");
    return;
  }
  const jsUrl = 'https://euromotors-it-inventory.vercel.app' + scriptMatch[1];
  console.log("Found JS Bundle:", jsUrl);

  // 2. Fetch JS bundle to extract API URL
  const jsRes = await fetch(jsUrl);
  const jsCode = await jsRes.text();

  const apiUrlMatch = jsCode.match(/https:\/\/[a-zA-Z0-9-]+\.onrender\.com\/api/);
  let API_URL = '';
  if (apiUrlMatch) {
    API_URL = apiUrlMatch[0];
    console.log("Extracted Render API URL:", API_URL);
  } else {
    console.log("Could not extract Render URL from JS, attempting common patterns...");
    API_URL = 'https://euromotors-it-inventory.onrender.com/api'; // Most likely Render app name
  }

  // Helper to make POST requests
  const post = async (url, body, token) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    return { status: res.status, body: await res.text() };
  };

  // Helper to make GET requests
  const get = async (url, token) => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    return { status: res.status, body: await res.text() };
  };

  // 3. Test SYSTEM ADMIN
  console.log("\n--- TESTING SYSTEM ADMIN ---");
  const adminLogin = await post(`${API_URL}/auth/login`, { email: 'admin@euromotors.local', password: 'TestPassword123!' });
  console.log(`Admin Login Status: ${adminLogin.status}`);
  if (adminLogin.status !== 200) {
    console.log("Admin Login Error:", adminLogin.body);
  } else {
    const adminToken = JSON.parse(adminLogin.body).token;
    const adminReports = await get(`${API_URL}/reports/assets`, adminToken);
    console.log(`Admin /reports/assets Status: ${adminReports.status} (Expected: 200)`);
    if (adminReports.status === 200) {
      const assets = JSON.parse(adminReports.body);
      console.log(`Admin retrieved ${assets.length} assets.`);
    }

    const adminDownload = await get(`${API_URL}/reports/download-all`, adminToken);
    console.log(`Admin /reports/download-all Status: ${adminDownload.status} (Expected: 200)`);
  }

  // 4. Test VIEWER
  console.log("\n--- TESTING VIEWER ---");
  const viewerLogin = await post(`${API_URL}/auth/login`, { email: 'viewer@euromotors.local', password: 'TestPassword123!' });
  console.log(`Viewer Login Status: ${viewerLogin.status}`);
  if (viewerLogin.status === 200) {
    const viewerToken = JSON.parse(viewerLogin.body).token;
    const viewerReports = await get(`${API_URL}/reports/assets`, viewerToken);
    console.log(`Viewer /reports/assets Status: ${viewerReports.status} (Expected: 403)`);
  }
}

testLiveSystem();
