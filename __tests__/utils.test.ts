import { describe, it, expect } from 'vitest';
import {
  cleanTitle,
  sanitizeNotionString,
  sanitizeNotionTag,
  isValidUrl,
  stripWikiFormatting,
  calculateSimilarity,
  countCommonWords,
  normalizeAuthor
} from '../utils';

describe('utils', () => {
  describe('cleanTitle', () => {
    it('removes extra spaces', () => {
      expect(cleanTitle('  Hello   World  ')).toBe('Hello World');
    });
    it('returns empty string for falsy values', () => {
      expect(cleanTitle('')).toBe('');
      expect(cleanTitle(null as any)).toBe('');
    });
  });

  describe('sanitizeNotionString', () => {
    it('removes control characters and limits length', () => {
      const longString = 'a'.repeat(2500);
      const sanitized = sanitizeNotionString(longString, 2000);
      expect(sanitized.length).toBe(2000);
      expect(sanitizeNotionString('Hello\x00World')).toBe('HelloWorld');
    });
  });

  describe('sanitizeNotionTag', () => {
    it('removes commas and control characters, limits to 100', () => {
      expect(sanitizeNotionTag('Sci-Fi, Fantasy')).toBe('Sci-Fi Fantasy');
      const longTag = 'a'.repeat(150);
      expect(sanitizeNotionTag(longTag).length).toBe(100);
    });
  });

  describe('isValidUrl', () => {
    it('validates http and https urls', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl(null)).toBe(false);
    });
  });

  describe('stripWikiFormatting', () => {
    it('removes wiki links and italics', () => {
      expect(stripWikiFormatting("''[[The Lord of the Rings|Władca Pierścieni]]''")).toBe('Władca Pierścieni');
      expect(stripWikiFormatting("[[Dune]]")).toBe('Dune');
    });
  });

  describe('calculateSimilarity', () => {
    it('calculates string similarity correctly', () => {
      expect(calculateSimilarity('test', 'test')).toBe(1);
      expect(calculateSimilarity('test', 'tast')).toBeGreaterThan(0.5);
      expect(calculateSimilarity('abc', 'xyz')).toBe(0);
    });
  });

  describe('countCommonWords', () => {
    it('counts common significant words', () => {
      expect(countCommonWords('The Lord of the Rings', 'Lord of Rings')).toBe(2); // 'lord', 'rings'
      expect(countCommonWords('Harry Potter and the Goblet of Fire', 'Harry Potter')).toBe(2);
    });
  });

  describe('normalizeAuthor', () => {
    it('normalizes author names', () => {
      expect(normalizeAuthor('Tolkien, J.R.R.')).toBe('jrr tolkien');
      expect(normalizeAuthor('Stanisław Lem (1921-2006)')).toBe('stanisław lem');
      expect(normalizeAuthor('George R. R. Martin')).toBe('george r r martin');
    });
  });
});
