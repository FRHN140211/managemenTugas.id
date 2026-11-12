import { createAuthClient } from '@neondatabase/auth';

window.MT = window.MT || {};
window.MT.neonAuthClient = createAuthClient(
  new URL('/api/neon-auth', window.location.origin).toString()
);
