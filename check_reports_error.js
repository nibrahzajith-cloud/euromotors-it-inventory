async function checkError() {
  const API_URL = 'https://euromotors-it-inventory.onrender.com/api';

  console.log("=== CHECKING REPORTS ERROR WITH USER CREDS ===");
  try {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nibrahz@euromotors.lk', password: 'Admin@123' })
    });
    
    if (loginRes.status !== 200) {
      console.log("Login failed", loginRes.status, await loginRes.text());
      return;
    }
    
    const token = (await loginRes.json()).token;
    console.log("Login successful!");
    
    const reportsRes = await fetch(`${API_URL}/reports/assets`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`Endpoint: /api/reports/assets`);
    console.log(`Status: ${reportsRes.status}`);
    const text = await reportsRes.text();
    console.log(`Response: ${text.substring(0, 500)}`);

    const downloadRes = await fetch(`${API_URL}/reports/download-all`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Endpoint: /api/reports/download-all`);
    console.log(`Status: ${downloadRes.status}`);
    const dlText = await downloadRes.text();
    console.log(`Response: ${dlText.substring(0, 500)}`);

  } catch(e) {
    console.error(e);
  }
}
checkError();
