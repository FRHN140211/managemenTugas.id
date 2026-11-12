#!/usr/bin/env python3
import json, os, pathlib, re

base = pathlib.Path('/c/laragon/www/Management_Tugas_Redesign_Terbaru')

print("=== package.json scripts ===")
with open(base / 'package.json', encoding='utf-8') as f:
    pkg = json.load(f)
print(json.dumps(pkg.get('scripts', {}), indent=2, ensure_ascii=False))

print("\n=== scripts/apply-migrations.js ===")
p = base / 'scripts' / 'apply-migrations.js'
print(p.read_text(encoding='utf-8') if p.exists() else "FILE NOT FOUND")

print("\n=== .env.local masked dump ===")
env_path = base / '.env.local'
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line.startswith(('TEST_DATABASE_URL=', 'DATABASE_URL=')):
            m = re.match(r'^(TEST_DATABASE_URL|DATABASE_URL)=(.+)$', line)
            if m:
                key, val = m.groups()
                val = val.strip().strip('"\'')
                try:
                    from urllib.parse import urlparse, parse_qs
                    u = urlparse(val)
                    print(f"{key} = postgres://{u.username}:***@{u.hostname}{u.path}?" + '&'.join(f"{k}={v}" for k, v in parse_qs(u.query).items()))
                except Exception:
                    print(f"{key} = <unparseable>")
else:
    print("NOT FOUND")
