async function checkRole() {
  const API_URL = 'https://euromotors-it-inventory.onrender.com/api';
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
    
    const body = await loginRes.json();
    console.log(`Login successful! User ID: ${body.user.id}, Role: ${body.user.role}`);
    
    const token = body.token;
    const reportsRes = await fetch(`${API_URL}/reports/assets`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Endpoint: /api/reports/assets => Status: ${reportsRes.status}`);

  } catch(e) {
    console.error(e);
  }
}
checkRole();
