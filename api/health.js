import { checkDatabase, handleHealthRequest } from '../lib/health.js';

export { checkDatabase };

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const result = await handleHealthRequest(request.method);
  if (result.statusCode === 405) {
    response.setHeader('Allow', 'GET');
  }
  return response.status(result.statusCode).json(result.body);
}