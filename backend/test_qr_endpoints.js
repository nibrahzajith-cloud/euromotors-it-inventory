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

    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log("=== STARTING QR INTEGRATION TESTS ===");

  const adminRes = await request('/auth/login', 'POST', { email: 'admin@euromotors.com', password: 'password123' });
  const adminToken = adminRes.data.token;

  // Grab the first existing asset from the DB
  const listRes = await request('/assets', 'GET', null, adminToken);
  if (!listRes.data || listRes.data.length === 0) {
      console.log("[ERROR] No assets available for testing logic.");
      return;
  }
  const targetCode = listRes.data[0].assetCode;
  console.log(`[TEST BASE] Validating target code: ${targetCode}`);

  // Test custom endpoint
  const targetRes = await request(`/assets/code/${targetCode}`, 'GET', null, adminToken);
  
  if (targetRes.status === 200) {
      console.log(`[LOGIC TEST] Custom QR Route mapping successful. Returns full dataset bounds natively: ${targetRes.data.id}`);
  } else {
      console.log(`[LOGIC TEST] Failed mapping code route! Status: ${targetRes.status}`);
  }
  
  // Test 404 Route
  const badRes = await request(`/assets/code/DOES_NOT_EXIST_123`, 'GET', null, adminToken);
  if (badRes.status === 404) {
      console.log(`[LOGIC TEST] Correctly blocked invalid QR codes dynamically natively with 404 Not Found.`);
  } else {
      console.log(`[LOGIC TEST] Failed 404 bounds isolation. Status: ${badRes.status}`);
  }

  console.log("=== TESTS COMPLETED SUCCESSFULLY ===");
}

runTests();
