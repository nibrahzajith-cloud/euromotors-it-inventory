const url = 'https://euromotors-it-inventory.vercel.app/api';

async function testLiveReports() {
  try {
    console.log(`Logging into ${url}/auth/login...`);
    const loginRes = await fetch(`${url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@euromotors.local', password: 'TestPassword123!' })
    });
    
    if (!loginRes.ok) {
      const err = await loginRes.text();
      console.error(`Login failed: ${loginRes.status} ${err}`);
      return;
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Login successful. Token acquired.');

    const headers = { 'Authorization': `Bearer ${token}` };

    console.log('Fetching /reports/assets...');
    const astRes = await fetch(`${url}/reports/assets`, { headers });
    console.log(`Assets Status: ${astRes.status}`);
    if (!astRes.ok) console.log(await astRes.text());

    console.log('Fetching /reports/assignments...');
    const asgRes = await fetch(`${url}/reports/assignments`, { headers });
    console.log(`Assignments Status: ${asgRes.status}`);
    if (!asgRes.ok) console.log(await asgRes.text());

    console.log('Fetching /reports/maintenance...');
    const mntRes = await fetch(`${url}/reports/maintenance`, { headers });
    console.log(`Maintenance Status: ${mntRes.status}`);
    if (!mntRes.ok) console.log(await mntRes.text());

  } catch (err) {
    console.error('Script Error:', err);
  }
}

testLiveReports();
