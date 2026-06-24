#!/usr/bin/env node
// Runs after `vite build`. Finds every bare inline <script> block in
// dist/index.html, computes its SHA-256 hash, and injects the hashes into
// the script-src directive of dist/staticwebapp.config.json so Azure SWA
// serves the correct CSP without needing 'unsafe-inline'.
const { readFileSync, writeFileSync } = require('fs');
const { createHash } = require('crypto');

const html = readFileSync('dist/index.html', 'utf-8');

// Match only bare <script>...</script> blocks (not type="module" etc.)
const inlineScriptRe = /<script>([\s\S]*?)<\/script>/g;
const hashes = [];
let m;
while ((m = inlineScriptRe.exec(html)) !== null) {
  const digest = createHash('sha256').update(m[1]).digest('base64');
  hashes.push(`'sha256-${digest}'`);
}

if (hashes.length === 0) {
  console.log('patch-csp: no inline scripts found, CSP unchanged.');
  process.exit(0);
}

const configPath = 'dist/staticwebapp.config.json';
const config = JSON.parse(readFileSync(configPath, 'utf-8'));
const csp = config.globalHeaders['Content-Security-Policy'];
config.globalHeaders['Content-Security-Policy'] = csp.replace(
  "script-src 'self'",
  `script-src 'self' ${hashes.join(' ')}`
);
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('patch-csp: injected', hashes.length, 'hash(es) into script-src:', hashes.join(' '));
