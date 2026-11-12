const http = require('http');

// Check if CDP is available at localhost:9222
const options = {
  hostname: 'localhost',
  port: 9222,
  path: '/json/version',
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('CDP version endpoint:', res.statusCode, data));
});

req.on('timeout', () => {
  console.log('Timeout');
  req.destroy();
});

req.on('error', (e) => console.log('Error:', e.message));
req.end();
