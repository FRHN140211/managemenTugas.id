import http from 'http';

// Get list of available browser targets
const options = {
  hostname: 'localhost',
  port: 9222,
  path: '/json/list',
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Available targets:');
    try {
      const targets = JSON.parse(data);
      targets.forEach(t => {
        if (t.url && t.url.startsWith('http://localhost:3000')) {
          console.log('  *', t.type, '|', t.title, '|', t.url, '| ws:', t.webSocketDebuggerUrl);
        } else {
          console.log('  -', t.type, '|', t.title, '|', t.url);
        }
      });
    } catch (e) {
      console.log('Raw:', data);
    }
  });
});

req.on('timeout', () => {
  console.log('Timeout');
  req.destroy();
});

req.on('error', (e) => console.log('Error:', e.message));
req.end();
