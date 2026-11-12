import http from 'http';
import ws from 'ws';

// Get the CDP WebSocket endpoint
const options = {
  hostname: 'localhost',
  port: 9222,
  path: '/json/list',
  method: 'GET',
  timeout: 3000
};

const targets = [];
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const targetsData = JSON.parse(data);
      targetsData.forEach(t => {
        if (t.type === 'page' && t.url.includes('blank')) {
          console.log('Found blank page:', t.webSocketDebuggerUrl);
          connectToCDP(t.webSocketDebuggerUrl);
        } else {
          console.log('Other:', t.type, t.title);
        }
      });
    } catch (e) {
      console.log('Error parsing:', e.message);
      console.log('Raw:', data);
    }
  });
});

req.on('timeout', () => { console.log('Timeout'); req.destroy(); });
req.on('error', (e) => console.log('Error:', e.message));
req.end();

function connectToCDP(wsUrl) {
  console.log('Connecting to CDP:', wsUrl);
  const client = new ws(wsUrl);
  
  client.on('open', () => {
    console.log('CDP connected');
    
    // Enable Page domain
    client.send(JSON.stringify({
      id: 1,
      method: 'Page.enable',
      params: {}
    }));
    
    // Try to get the list of pages
    client.send(JSON.stringify({
      id: 2,
      method: 'Page.getTargetId',
      params: {}
    }));
  });
  
  client.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('CDP message:', JSON.stringify(msg).substring(0, 200));
  });
}
