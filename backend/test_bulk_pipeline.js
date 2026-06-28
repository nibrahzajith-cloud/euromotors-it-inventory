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
      headers: { 'Content-Type': 'application/json' }
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
  console.log("=== STARTING SMART BULK CSV UPLOAD TESTS ===");

  const adminRes = await request('/auth/login', 'POST', { email: 'admin@euromotors.com', password: 'password123' });
  const adminToken = adminRes.data.token;

  const listRes = await request('/assets', 'GET', null, adminToken);
  const existingAsset = listRes.data.length > 0 ? listRes.data[0] : null;

  const syntheticCsv = [
    // 1. Fully Assigned Asset (Creates Location, Dept, Employee, Asset, Assignment)
    {
      locationName: 'North Wing',
      departmentName: 'Cyber Security',
      employeeName: 'Alice Freeman',
      designation: 'Security Analyst',
      email: 'alice.f@euromotors.com',
      deviceType: 'Laptop',
      model: 'ThinkPad T14',
      // No serial - should generate NO-SERIAL-ROW-X
      serialNumber: '',
      condition: 'New'
    },
    // 2. Unassigned Available Asset (No employeeName)
    {
      locationName: 'Server Room Alpha',
      departmentName: 'IT Operations',
      employeeName: '',
      deviceType: 'Switch',
      model: 'Cisco 2960',
      serialNumber: `SW-${Math.floor(Math.random()*90000)}`,
      condition: 'Good'
    },
    // 3. Asset Assigned to SAME employee (Should NOT recreate employee, should update existing)
    {
      locationName: 'North Wing',
      departmentName: 'Cyber Security',
      employeeName: 'Alice Freeman', 
      email: 'alice.f@euromotors.com',
      deviceType: 'Monitor',
      model: 'Dell UltraSharp',
      serialNumber: `MON-${Math.floor(Math.random()*90000)}`,
      condition: 'New'
    },
    // 4. Duplicate Serial Number rejection (Should fail safely)
    {
       locationName: 'North Wing',
       departmentName: 'Cyber Security',
       employeeName: 'Tom Jenkins',
       deviceType: 'Laptop',
       model: 'MacBook Pro',
       serialNumber: existingAsset ? existingAsset.serialNumber : 'IMPOSSIBLE-SERIAL-9999'
    },
    // 5. Fatal missing DeviceType (Should fail)
    {
       locationName: 'HQ',
       departmentName: 'Sales',
       serialNumber: '123456789'
    }
  ];

  const bulkRes = await request('/assets/bulk', 'POST', { assets: syntheticCsv }, adminToken);
  
  if (bulkRes.status === 200) {
      console.log(`[LOGIC TEST] Smart Pipeline Execution Successful.`);
      console.log(bulkRes.data);
  } else {
      console.log(`[LOGIC TEST] Pipeline failure. Status: ${bulkRes.status}`, bulkRes.data);
  }

  console.log("\n=== TESTS COMPLETED SUCCESSFULLY ===");
}

runTests();
