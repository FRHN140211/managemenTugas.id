import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const id = JSON.parse(readFileSync(join(ROOT, 'assets/locales/id.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(ROOT, 'assets/locales/en.json'), 'utf8'));

test('L1-i18n-parity: id == en key sets, all values non-empty, placeholders identical', () => {
  const norm = (o) => {
    const r = {};
    for (const [k, v] of Object.entries(o)) r[k] = v === undefined ? null : v;
    return r;
  };
  const a = norm(id);
  const b = norm(en);
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  assert.equal(keysA.length, keysB.length, `key count id=${keysA.length} en=${keysB.length}`);
  for (const k of keysA) assert.ok(k in b, `key missing in en: ${k}`);
  for (const k of keysB) assert.ok(k in a, `key missing in id: ${k}`);
  for (const k of keysA) {
    assert.ok(typeof a[k] === 'string' && a[k].trim().length > 0, `id value empty for ${k}`);
    assert.ok(typeof b[k] === 'string' && b[k].trim().length > 0, `en value empty for ${k}`);
  }
  const ph = (o) => [...new Set(Object.values(o).filter(v => typeof v === 'string' && /\{\d+\}/.test(v)))];
  assert.deepEqual(ph(id), ph(en), 'placeholder sets differ (id vs en)');
});
