const jwt = require('jsonwebtoken');

async function testMe() {
   const token = jwt.sign({ id: 'test_admin_id', email: 'admin@euromotors.com', role: 'ADMIN' }, 'super_secret_jwt_key_for_euro_motors', { expiresIn: '1h' });

   try {
     console.log('Testing Get Me...');
     const res = await fetch('http://localhost:5000/api/auth/me', {
       method: 'GET',
       headers: {
         'Authorization': `Bearer ${token}`
       }
     });
     
     const text = await res.text();
     console.log('Get Me Response:', res.status, text);
   } catch(e) {
     console.error('Fetch Error:', e);
   }
}

testMe();
