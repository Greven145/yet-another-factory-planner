import { describe, it, expect } from 'vitest';
import { buildShareUrl, parseShareKeys, MAX_SHARE_FACTORIES } from './share-url';

const origin = () => `${window.location.protocol}//${window.location.host}${window.location.pathname}`;

describe('buildShareUrl', () => {
  it('builds a single-key link with no comma (unchanged single-share link)', () => {
    expect(buildShareUrl(['abc123'])).toBe(`${origin()}?factory=abc123`);
  });

  it('comma-joins multiple keys, unencoded', () => {
    expect(buildShareUrl(['a', 'b', 'c'])).toBe(`${origin()}?factory=a,b,c`);
  });

  it('does not truncate at the cap — the cap is enforced by callers', () => {
    const keys = Array.from({ length: MAX_SHARE_FACTORIES + 10 }, (_, i) => `k${i}`);
    const url = buildShareUrl(keys);
    expect(url.endsWith(`?factory=${keys.join(',')}`)).toBe(true);
  });
});

describe('parseShareKeys', () => {
  it('returns [] for null/empty', () => {
    expect(parseShareKeys(null)).toEqual([]);
    expect(parseShareKeys('')).toEqual([]);
  });

  it('returns a single key for a comma-less param', () => {
    expect(parseShareKeys('abc123')).toEqual(['abc123']);
  });

  it('splits on comma', () => {
    expect(parseShareKeys('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace and drops empty segments', () => {
    expect(parseShareKeys(' a , b ,,c, ')).toEqual(['a', 'b', 'c']);
  });

  it('round-trips through buildShareUrl for many keys', () => {
    const keys = Array.from({ length: 60 }, (_, i) => `k${i}`);
    const param = buildShareUrl(keys).split('?factory=')[1];
    expect(parseShareKeys(param)).toEqual(keys);
  });
});

describe('MAX_SHARE_FACTORIES', () => {
  it('is 50', () => {
    expect(MAX_SHARE_FACTORIES).toBe(50);
  });
});
