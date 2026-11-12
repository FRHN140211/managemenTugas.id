#!/usr/bin/env python3
import sys

FILE_PATH = 'api/[...path].js'

with open(FILE_PATH, 'r', encoding='utf-8', newline='') as f:
    content = f.read()

# Find the handler function start
old_func_start = content.find('export default async function handler')
if old_func_start == -1:
    print('Handler not found')
    sys.exit(1)

# Find the end of the function (next function definition)
old_func_end = content.find('if (url.pathname.startsWith', old_func_start)
if old_func_end == -1:
    print('End marker not found')
    sys.exit(1)

# Build the new function
new_func = """export default async function handler(request, response) {
  const url = new URL(request.url || '/', 'https://' + (request.headers.host || 'localhost'));

  // Forgot password / reset password (Neon Auth)
  if (url.pathname === '/api/auth/forgot-password') {
    const result = await proxyNeonAuthRequest({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body
    });
    for (const [name, value] of Object.entries(result.headers || {})) {
      response.setHeader(name, value);
    }
    response.status(result.status);
    if (result.body === null || result.body === undefined) return response.end();
    return result.raw ? response.send(result.body) : response.json(result.body);
  }

  if (url.pathname === '/api/auth/reset-password') {
    const result = await proxyNeonAuthRequest({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body
    });
    for (const [name, value] of Object.entries(result.headers || {})) {
      response.setHeader(name, value);
    }
    response.status(result.status);
    if (result.body === null || result.body === undefined) return response.end();
    return result.raw ? response.send(result.body) : response.json(result.body);
  }

  if (url.pathname.startsWith('/api/neon-auth/')) {"""

# Replace
new_content = content[:old_func_start] + new_func + content[old_func_end:]

with open(FILE_PATH, 'w', encoding='utf-8', newline='') as f:
    f.write(new_content)

print('Done')
