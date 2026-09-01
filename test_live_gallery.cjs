const https = require('https');

const req = https.request({
  hostname: 'euromotors-it-inventory.onrender.com',
  port: 443,
  path: '/api/uploads/gallery/123',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
  }
}, res => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
});

req.on('error', e => console.error(e));
req.write('------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="images"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n');
req.end();
