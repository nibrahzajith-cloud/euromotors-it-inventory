const jwt = require('jsonwebtoken');
require('dotenv').config();
const token = jwt.sign({ id: 'test-admin', role: 'ADMIN' }, process.env.JWT_SECRET || 'secret');
console.log('Generated token:', token);

fetch('http://localhost:5000/api/database/clear-activity', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}).then(res => {
  console.log('Status:', res.status);
  console.log('Headers:', res.headers);
  return res.text();
}).then(text => {
  console.log('Body:', text);
}).catch(err => {
  console.error('Error:', err);
});
