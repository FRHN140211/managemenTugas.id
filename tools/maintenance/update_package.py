#!/usr/bin/env python3
import json, sys

with open('package.json', 'r', encoding='utf-8') as f:
    pkg = json.load(f)

# Add scripts
pkg.setdefault('scripts', {})
pkg['scripts'] = {
    'build': 'vite build --config vite.auth.config.js',
    'predev': 'npm run build',
    'dev': 'node server.js',
    'start': 'node server.js',
    'bootstrap:owner': 'node scripts/bootstrap-owner.js',
    'test': 'node --test',
    'test:unit': 'node --test tests/api.test.js tests/server.test.js tests/store-auth.test.js',
    'test:integration': 'node --test tests/pagination-owner.integration.test.js',
    'test:e2e': 'playwright test',
    'test:all': 'npm run test:unit && npm run test:integration && npm run test:e2e'
}

# Add dependencies
pkg.setdefault('dependencies', {})
pkg['dependencies']['ioredis'] = '^5.4.2'
pkg['dependencies']['resend'] = '^3.2.0'

# Add devDependencies
pkg.setdefault('devDependencies', {})
pkg['devDependencies']['playwright'] = '^1.48.0'

with open('package.json', 'w', encoding='utf-8') as f:
    json.dump(pkg, f, indent=2)
    f.write('\n')

print('package.json updated')
print('Scripts:', list(pkg['scripts'].keys()))
print('Dependencies:', list(pkg['dependencies'].keys()))
print('DevDependencies:', list(pkg['devDependencies'].keys()))
