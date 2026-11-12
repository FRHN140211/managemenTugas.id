import * as fs from 'node:fs';
const root = 'C:/laragon/www/Management_Tugas_Redesign_Terbaru';
const content = fs.readFileSync(root + '/.env.local', 'utf8');

for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('TEST_DATABASE_URL=') || trimmed.startsWith('DATABASE_URL=')) {
    const quoted = trimmed.replace(/^([^=]+=)(.*)$/, (_, k, v) => {
      try {
        const parsed = JSON.parse(v);
        return `${k}=<redacted:${parsed.length} chars>`;
      } catch {
        return `${k}=<redacted>`;
      }
    });
    console.log(quoted);
  }
}
