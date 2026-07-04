import { expect } from 'vitest';

// Two numbers are "close" iff |a - b| <= ATOL + RTOL * max(|a|, |b|).
export const RTOL = 1e-6;
export const ATOL = 1e-9;

function numbersClose(a: number, b: number): boolean {
  if (Number.isNaN(a) || Number.isNaN(b)) return Object.is(a, b);
  return Math.abs(a - b) <= ATOL + RTOL * Math.max(Math.abs(a), Math.abs(b));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function show(v: unknown): string {
  if (typeof v === 'number' || typeof v === 'boolean' || v === null) return String(v);
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return String(v);
}

// Deep-compare two already-canonicalized structures with per-numeric-leaf
// tolerance. Returns the first failing path (e.g.
// `$.report.powerUsageEstimate.total: received 47.2 vs expected 47.9`) or null
// when every leaf matches.
export function findFirstMismatch(a: unknown, b: unknown, path = '$'): string | null {
  if (typeof a === 'number' && typeof b === 'number') {
    return numbersClose(a, b) ? null : `${path}: received ${a} vs expected ${b}`;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return `${path}: received ${show(a)} vs expected ${show(b)}`;
    }
    if (a.length !== b.length) {
      return `${path}: array length ${a.length} vs expected ${b.length}`;
    }
    for (let i = 0; i < a.length; i++) {
      const m = findFirstMismatch(a[i], b[i], `${path}[${i}]`);
      if (m) return m;
    }
    return null;
  }

  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) {
      return `${path}: received ${show(a)} vs expected ${show(b)}`;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of [...keys].sort()) {
      if (!(key in a)) return `${path}.${key}: missing on received`;
      if (!(key in b)) return `${path}.${key}: missing on expected`;
      const m = findFirstMismatch(a[key], b[key], `${path}.${key}`);
      if (m) return m;
    }
    return null;
  }

  return Object.is(a, b) ? null : `${path}: received ${show(a)} vs expected ${show(b)}`;
}

// Raw matcher fn, exported so it can be unit-tested directly.
export function toBeCloseToDeep(received: unknown, expected: unknown) {
  const mismatch = findFirstMismatch(received, expected);
  return {
    pass: mismatch === null,
    message: () =>
      mismatch === null
        ? 'expected structures not to be deeply close, but they are'
        : `structures differ at ${mismatch}`,
  };
}

expect.extend({ toBeCloseToDeep });

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeCloseToDeep(expected: unknown): T
  }
  interface AsymmetricMatchersContaining {
    toBeCloseToDeep(expected: unknown): unknown
  }
}
