#!/usr/bin/env node
// Thin shim that lets the pipeline invoke smoke tests as:
//
//   npm run test:smoke -- --url <preview_url>
//
// Playwright's CLI does not have a --url flag; this script extracts it and
// sets SMOKE_URL in the environment before forwarding the remaining args to
// `playwright test --config playwright.smoke.config.ts`.

'use strict';

const { spawnSync } = require('child_process');

const args = process.argv.slice(2);

// Extract --url <value> if present.
const urlIndex = args.indexOf('--url');
if (urlIndex !== -1) {
  const urlValue = args[urlIndex + 1];
  if (urlValue && !urlValue.startsWith('-')) {
    process.env.SMOKE_URL = urlValue;
    args.splice(urlIndex, 2); // remove --url <value> from the forwarded args
  } else {
    console.error('smoke-runner: --url requires a URL argument');
    process.exit(1);
  }
}

// Fail fast with a clear message rather than letting Playwright fall back to
// localhost and surface a confusing CONNECTION_REFUSED on CI.
if (!process.env.SMOKE_URL) {
  console.error('smoke-runner: SMOKE_URL is not set. Pass --url <url> or set SMOKE_URL.');
  process.exit(1);
}

// Use the locally installed playwright binary (not npx) to avoid version skew,
// and propagate its exit code explicitly so CI sees real pass/fail.
const result = spawnSync(
  'node_modules/.bin/playwright',
  ['test', '--config', 'playwright.smoke.config.ts', ...args],
  { stdio: 'inherit', env: process.env },
);
process.exit(result.status ?? 1);
