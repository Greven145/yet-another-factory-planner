#!/usr/bin/env node
// Thin shim that lets the pipeline invoke smoke tests as:
//
//   npm run test:smoke -- --url <preview_url>
//
// Playwright's CLI does not have a --url flag; this script extracts it and
// sets SMOKE_URL in the environment before forwarding the remaining args to
// `playwright test --config playwright.smoke.config.ts`.

'use strict';

const { execFileSync } = require('child_process');

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

// Forward remaining args (e.g. --headed, --debug) to playwright.
execFileSync(
  'npx',
  ['playwright', 'test', '--config', 'playwright.smoke.config.ts', ...args],
  { stdio: 'inherit', env: process.env },
);
