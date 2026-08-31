const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/uploads/gallery/test',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer test_token', // We would need a real token or just see the auth error first
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', (e) => console.error(e));
req.end();
