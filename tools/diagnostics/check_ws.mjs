// Check if ws module works correctly
import fs from 'fs';
const wsModule = await import('ws');
console.log('module default:', typeof wsModule.default);
console.log('exports:', Object.keys(wsModule).join(', '));
