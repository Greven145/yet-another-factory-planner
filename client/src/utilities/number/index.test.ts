import { truncateFloat } from './index';

describe('truncateFloat', () => {
  it('truncates to 4 decimal places by default', () => {
    expect(truncateFloat(3.14159265)).toBe('3.1416');
  });

  it('removes trailing zeros', () => {
    expect(truncateFloat(3.1)).toBe('3.1');
    expect(truncateFloat(3.10)).toBe('3.1');
    expect(truncateFloat(3.0)).toBe('3');
  });

  it('handles integers', () => {
    expect(truncateFloat(42)).toBe('42');
    expect(truncateFloat(0)).toBe('0');
  });

  it('respects custom decimal places', () => {
    expect(truncateFloat(3.14159, 2)).toBe('3.14');
    expect(truncateFloat(3.14159, 6)).toBe('3.14159');
    expect(truncateFloat(3.14159, 0)).toBe('3');
  });

  it('handles negative numbers', () => {
    expect(truncateFloat(-3.14159)).toBe('-3.1416');
    expect(truncateFloat(-0.001)).toBe('-0.001');
  });

  it('handles very small numbers', () => {
    expect(truncateFloat(0.00001)).toBe('0');
    expect(truncateFloat(0.00001, 6)).toBe('0.00001');
  });

  it('handles very large numbers', () => {
    expect(truncateFloat(1000000.5)).toBe('1000000.5');
  });
});
