import http from 'http';
import wsModule from 'ws';
const WebSocket = wsModule.default || wsModule;

// Connect to CDP via WebSocket
const wsUrl = 'ws://localhost:9222/devtools/browser/2016241b-df67-4dae-b55f-b0f63c7cdc87';

const client = new WebSocket(wsUrl);

client.on('open', () => {
  console.log('Connected to CDP');
  
  // Enable Page domain
  client.send(JSON.stringify({
    id: 1,
    method: 'Page.enable',
    params: {}
  }));
  
  // Navigate to the application
  client.send(JSON.stringify({
    id: 2,
    method: 'Page.navigate',
    params: {
      url: 'http://localhost:3000/'
    }
  }));
});

client.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('CDP message:', msg);
  
  if (msg.id === 2) {
    // Wait for navigation to complete
    setTimeout(() => {
      // Get page info
      client.send(JSON.stringify({
        id: 3,
        method: 'Page.getTitle',
        params: {}
      }));
      
      client.send(JSON.stringify({
        id: 4,
        method: 'Page.getNavigationHistory',
        params: {}
      }));
    }, 1000);
  }
  
  if (msg.id === 3) {
    console.log('Page title:', msg.result.title);
    // Check if we can interact with the page
    client.send(JSON.stringify({
      id: 5,
      method: 'DOM.getDocument',
      params: {}
    }));
  }
});

client.on('error', (err) => {
  console.log('WebSocket error:', err.message);
});

client.on('close', () => {
  console.log('Connection closed');
});
