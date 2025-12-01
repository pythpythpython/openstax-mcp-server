#!/usr/bin/env node

const url = process.argv[2];

if (!url) {
  console.error('Usage: node mcp-proxy.js <url>');
  process.exit(1);
}

async function post(payload) {
  try {
    if (!payload || Object.keys(payload).length === 0) return;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return; // Silence HTTP errors

    const data = await response.json();
    
    // MAGIC FIX: Cursor hates responses with id: null. 
    // We filter them out because they are just noise (usually empty keep-alive pings).
    if (data.id === null || data.id === undefined) return;

    console.log(JSON.stringify(data));
  } catch (error) {
    // Silence network errors to keep connection alive
  }
}

process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); 
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const request = JSON.parse(line);
        post(request);
      } catch (e) {}
    }
  }
});
