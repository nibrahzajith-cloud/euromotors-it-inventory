const jwt = require('jsonwebtoken');

async function testBackend() {
   const token = jwt.sign({ id: 'test_admin_id', email: 'admin@euromotors.com', role: 'ADMIN' }, 'super_secret_jwt_key_for_euro_motors', { expiresIn: '1h' });

   try {
     console.log('Testing User Creation...');
     const res1 = await fetch('http://localhost:5000/api/users', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${token}`
       },
       body: JSON.stringify({
         fullName: 'Script Test',
         email: `script${Date.now()}@test.com`,
         role: 'VIEWER',
         status: 'ACTIVE'
       })
     });
     
     const text1 = await res1.text();
     console.log('Create Response:', res1.status, text1);
   } catch(e) {
     console.error('Fetch Error:', e);
   }
}

testBackend();
