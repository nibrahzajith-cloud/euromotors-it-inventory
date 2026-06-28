async function testLogin() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@euromotors.com', password: 'password123' }) // Try password123 or admin123
    });
    
    const loginData = await loginRes.json();
    console.log('Login Status:', loginRes.status);
    console.log('Login Data:', loginData);
    
    if (loginData.token) {
      const meRes = await fetch('http://localhost:5000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      });
      console.log('Me Status:', meRes.status);
      console.log('Me Data:', await meRes.text());
    }
  } catch (e) {
    console.error(e);
  }
}
testLogin();
