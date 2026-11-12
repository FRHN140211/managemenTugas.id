import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

const child = spawn('npx', ['rollup-plugin-visualizer', ...args], {
  stdio: 'inherit',
  shell: true,
});

child.on('error', (err) => {
  console.error('Failed to start bundle visualizer:', err.message);
  process.exit(1);
});
