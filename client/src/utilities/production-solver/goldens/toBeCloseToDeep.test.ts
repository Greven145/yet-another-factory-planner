import { describe, expect, it } from 'vitest';
import { ATOL, RTOL, findFirstMismatch, toBeCloseToDeep } from './toBeCloseToDeep';

describe('constants', () => {
  it('exposes RTOL and ATOL', () => {
    expect(RTOL).toBe(1e-6);
    expect(ATOL).toBe(1e-9);
  });
});

describe('findFirstMismatch', () => {
  it('returns null for numbers equal within relative tolerance', () => {
    // diff 1e-7 <= 1e-9 + 1e-6 * ~1 -> close
    expect(findFirstMismatch(1.0000001, 1.0)).toBeNull();
  });

  it('returns null for near-zero numbers within absolute tolerance', () => {
    // diff 1e-10 <= 1e-9 -> close
    expect(findFirstMismatch(1e-10, 0)).toBeNull();
  });

  it('reports a path for out-of-tolerance numbers', () => {
    const m = findFirstMismatch({ report: { total: 47.2 } }, { report: { total: 47.9 } });
    expect(m).toContain('$.report.total');
    expect(m).toContain('47.2');
    expect(m).toContain('47.9');
  });

  it('recurses nested objects and arrays', () => {
    const a = { a: [1, { b: 2 }] };
    const b = { a: [1, { b: 2.0000001 }] };
    expect(findFirstMismatch(a, b)).toBeNull();

    const c = { a: [1, { b: 2 }] };
    const d = { a: [1, { b: 5 }] };
    expect(findFirstMismatch(c, d)).toContain('$.a[1].b');
  });

  it('fails on array length mismatch', () => {
    const m = findFirstMismatch([1, 2], [1, 2, 3]);
    expect(m).toBeTruthy();
    expect(m).toContain('$');
    expect(m).toContain('length');
  });

  it('fails on a missing key', () => {
    expect(findFirstMismatch({ a: 1 }, { a: 1, b: 2 })).toContain('missing on received');
    expect(findFirstMismatch({ a: 1, b: 2 }, { a: 1 })).toContain('missing on expected');
  });

  it('fails on number-vs-string', () => {
    expect(findFirstMismatch({ a: 1 }, { a: '1' })).toContain('$.a');
  });

  it('compares non-number primitives with Object.is', () => {
    expect(findFirstMismatch('x', 'x')).toBeNull();
    expect(findFirstMismatch(true, false)).toContain('$');
    expect(findFirstMismatch(null, null)).toBeNull();
  });
});

describe('toBeCloseToDeep matcher fn', () => {
  it('passes within tolerance', () => {
    expect(toBeCloseToDeep(1.0000001, 1.0).pass).toBe(true);
  });

  it('fails out of tolerance with a path in the message', () => {
    const r = toBeCloseToDeep({ total: 47.2 }, { total: 47.9 });
    expect(r.pass).toBe(false);
    expect(r.message()).toContain('$.total');
  });
});

describe('registered expect().toBeCloseToDeep', () => {
  it('passes for structures close within tolerance', () => {
    expect({ a: [1, { b: 2.0000001 }], c: 'x' }).toBeCloseToDeep({ a: [1, { b: 2 }], c: 'x' });
  });

  it('passes for near-zero absolute closeness', () => {
    expect({ v: 1e-10 }).toBeCloseToDeep({ v: 0 });
  });

  it('fails for out-of-tolerance structures', () => {
    expect(() =>
      expect({ report: { total: 47.2 } }).toBeCloseToDeep({ report: { total: 47.9 } }),
    ).toThrow();
  });

  it('fails on a length mismatch', () => {
    expect(() => expect([1, 2]).toBeCloseToDeep([1, 2, 3])).toThrow();
  });

  it('fails on a missing key', () => {
    expect(() => expect({ a: 1 }).toBeCloseToDeep({ a: 1, b: 2 })).toThrow();
  });

  it('fails on number-vs-string', () => {
    expect(() => expect({ a: 1 }).toBeCloseToDeep({ a: '1' })).toThrow();
  });
});
