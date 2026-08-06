import { describe, it, expect } from 'vitest';
import { normalizeData } from '../dataNormalizer';

describe('dataNormalizer', () => {
  it('normalizes publishers', () => {
    expect(normalizeData('Zysk', 'publisher')).toBe('Zysk i S-ka');
    expect(normalizeData('Prószyński', 'publisher')).toBe('Prószyński i S-ka');
    expect(normalizeData('Unknown', 'publisher')).toBe('Unknown');
  });

  it('normalizes authors', () => {
    expect(normalizeData('Liu Cixin', 'author')).toBe('Liu Cixin, Ken Liu');
    expect(normalizeData('Cixin Liu', 'author')).toBe('Liu Cixin, Ken Liu');
    expect(normalizeData('Ann Leckie', 'author')).toBe('Ann Leckie');
    expect(normalizeData('Anne Leckie', 'author')).toBe('Ann Leckie');
  });

  it('normalizes series', () => {
    expect(normalizeData('Kameleon (seria)', 'series')).toBe('Kameleon');
    expect(normalizeData('Klasyka SF', 'series')).toBe('Klasyka Science Fiction');
  });

  it('is case insensitive', () => {
    expect(normalizeData('zysk', 'publisher')).toBe('Zysk i S-ka');
    expect(normalizeData('liu cixin', 'author')).toBe('Liu Cixin, Ken Liu');
  });
});
