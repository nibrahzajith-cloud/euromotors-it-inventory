const fs = require('fs');

async function testUpload() {
  const API_URL = 'http://localhost:5000/api';
  console.log("=== CHECKING UPLOAD ERROR ===");
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

    // We need an asset ID
    const assetsRes = await fetch(`${API_URL}/assets`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const assets = await assetsRes.json();
    if(!assets || assets.length === 0) {
        console.log("No assets found");
        return;
    }
    const asset = assets[0];

    const formData = new FormData();
    // create a fake image blob
    const buffer = Buffer.from('fake image data');
    formData.append('images', new Blob([buffer], { type: 'image/webp' }), 'test1.webp');
    formData.append('images', new Blob([buffer], { type: 'image/webp' }), 'test2.webp');

    const uploadRes = await fetch(`${API_URL}/uploads/gallery/${asset.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    console.log("Upload status:", uploadRes.status);
    console.log("Upload response:", await uploadRes.text());

  } catch(e) {
    console.error(e);
  }
}

testUpload();
