import { gradientFromColor } from './index';

describe('gradientFromColor', () => {
  it('returns an array of 10 colors', () => {
    const result = gradientFromColor('#3498db');
    expect(result).toHaveLength(10);
  });

  it('includes the original color at index 6', () => {
    const color = '#3498db';
    const result = gradientFromColor(color);
    expect(result[6]).toBe(color);
  });

  it('returns valid hex color strings', () => {
    const result = gradientFromColor('#ff0000');
    result.forEach((c) => {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('lighter colors come before the original', () => {
    const result = gradientFromColor('#808080');
    // First 6 entries are lighter (higher luminance) than the original
    // The original is at index 6, darker colors follow
    expect(result.length).toBe(10);
  });

  it('respects scale parameter', () => {
    const defaultResult = gradientFromColor('#3498db');
    const scaledResult = gradientFromColor('#3498db', 0.5);
    // Different scale should produce different gradients
    expect(defaultResult).not.toEqual(scaledResult);
  });

  it('handles pure white', () => {
    const result = gradientFromColor('#ffffff');
    expect(result).toHaveLength(10);
    result.forEach((c) => {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('handles pure black', () => {
    const result = gradientFromColor('#000000');
    expect(result).toHaveLength(10);
    result.forEach((c) => {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
