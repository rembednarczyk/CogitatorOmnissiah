import { describe, it, expect } from 'vitest';
import { buildAuthorTags, buildBookUpdates, buildNewBookProperties } from '../bookDiff';
import { Book, NotionBook } from '../../src/types';

const notionBook = (over: Partial<NotionBook>): NotionBook => ({
  id: '1', plTitle: '', origTitle: '', author: '', year: '', awards: [], zrodlo: [],
  currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, lp: '1',
  plTitleRichText: [], origTitleRichText: [], ...over,
});

describe('buildAuthorTags', () => {
  it('never emits a multi_select tag containing a comma, even when a mapping injects one', () => {
    // "Liu Cixin" maps to "Liu Cixin, Ken Liu"; Notion rejects commas in options.
    const tags = buildAuthorTags('Liu Cixin');
    expect(tags).toEqual(['Liu Cixin', 'Ken Liu']);
    expect(tags.some(t => t.includes(','))).toBe(false);
  });

  it('splits an already-merged comma author string into clean tags and dedups', () => {
    expect(buildAuthorTags('Liu Cixin, Ken Liu')).toEqual(['Liu Cixin', 'Ken Liu']);
  });

  it('handles the Hamilton pseudonym mapping without a comma tag', () => {
    const tags = buildAuthorTags('Edmond Hamilton (jako Brett Sterling)');
    expect(tags).toEqual(['Edmond Hamilton', 'Brett Sterling']);
    expect(tags.some(t => t.includes(','))).toBe(false);
  });

  it('passes ordinary single authors through unchanged', () => {
    expect(buildAuthorTags('Stanisław Lem')).toEqual(['Stanisław Lem']);
  });

  it('returns [] for empty input', () => {
    expect(buildAuthorTags('')).toEqual([]);
  });
});

describe('buildBookUpdates', () => {
  it('returns updates when titles differ', () => {
    const existing = notionBook({ plTitle: 'Stary', origTitle: '', author: 'Lem', year: '2000' });
    const newBook: Book = { polishTitle: 'Nowy', originalTitle: 'New', author: 'Lem', year: '2000', award: 'Test', polishTitleLink: null };
    const updates = buildBookUpdates(existing, newBook);
    expect(updates).toHaveProperty('Tytuł polski');
    expect(updates).toHaveProperty('Tytuł oryginalny');
  });

  it('returns empty object when books are identical', () => {
    const existing = notionBook({ plTitle: 'Solaris', origTitle: 'Solaris', author: 'Stanisław Lem', year: '1961', awards: ['Nagroda Test'] });
    const newBook: Book = { polishTitle: 'Solaris', originalTitle: 'Solaris', author: 'Stanisław Lem', year: '1961', award: 'Nagroda Test', awards: ['Nagroda Test'], polishTitleLink: null };
    expect(buildBookUpdates(existing, newBook)).toEqual({});
  });

  it('merges authors instead of replacing manually added ones', () => {
    const existing = notionBook({ plTitle: 'Diuna', origTitle: 'Dune', author: 'Frank Herbert, Brian Herbert', year: '1965', awards: ['Nagroda Hugo'] });
    const newBook: Book = { polishTitle: 'Diuna', originalTitle: 'Dune', author: 'Frank Herbert', year: '1965', award: 'Nagroda Hugo', awards: ['Nagroda Hugo'], polishTitleLink: null };
    // Wiki has fewer authors than Notion — nothing to add, nothing removed
    expect(buildBookUpdates(existing, newBook)).not.toHaveProperty('Autor');
  });

  it('adds new wiki authors while keeping existing ones', () => {
    const existing = notionBook({ plTitle: 'Diuna', origTitle: 'Dune', author: 'Frank Herbert', year: '1965', awards: ['Nagroda Hugo'] });
    const newBook: Book = { polishTitle: 'Diuna', originalTitle: 'Dune', author: 'Frank Herbert, Kevin J. Anderson', year: '1965', award: 'Nagroda Hugo', awards: ['Nagroda Hugo'], polishTitleLink: null };
    const updates = buildBookUpdates(existing, newBook);
    expect(updates).toHaveProperty('Autor');
    const names = updates['Autor'].multi_select.map((o: any) => o.name);
    expect(names).toContain('Frank Herbert');
    expect(names).toContain('Kevin J. Anderson');
  });

  it('is idempotent when Notion stores a different-case author (no churny re-updates)', () => {
    const existing = notionBook({ plTitle: 'Slan', origTitle: 'Slan', author: 'A. E. van Vogt', year: '1941', awards: ['Nagroda Hugo'] });
    const newBook: Book = { polishTitle: 'Slan', originalTitle: 'Slan', author: 'A. E. Van Vogt', year: '1941', award: 'Nagroda Hugo', awards: ['Nagroda Hugo'], polishTitleLink: null };
    expect(buildBookUpdates(existing, newBook)).not.toHaveProperty('Autor');
  });

  it('is idempotent for a multi-author book with mixed casing', () => {
    const existing = notionBook({ plTitle: 'The Winged Man', origTitle: 'The Winged Man', author: 'A. E. van Vogt, Edna Mayne Hull', year: '1945', awards: ['Nagroda Hugo'] });
    const newBook: Book = { polishTitle: 'The Winged Man', originalTitle: 'The Winged Man', author: 'A. E. Van Vogt, Edna Mayne Hull', year: '1945', award: 'Nagroda Hugo', awards: ['Nagroda Hugo'], polishTitleLink: null };
    expect(buildBookUpdates(existing, newBook)).not.toHaveProperty('Autor');
  });
});

describe('buildNewBookProperties', () => {
  it('builds comma-free author tags and adds "Wszystkie" for the triple crown', () => {
    const book: Book = {
      polishTitle: 'Diuna', originalTitle: 'Dune', author: 'Liu Cixin', year: '1965',
      award: 'Nagroda Hugo', awards: ['Nagroda Hugo', 'Nagroda Nebula', 'Nagroda Locus'], polishTitleLink: null,
    };
    const props = buildNewBookProperties(book);
    const authorNames = props['Autor'].multi_select.map((o: any) => o.name);
    expect(authorNames).toEqual(['Liu Cixin', 'Ken Liu']);
    expect(authorNames.some((n: string) => n.includes(','))).toBe(false);
    const awardNames = props['Nagroda'].multi_select.map((o: any) => o.name);
    expect(awardNames).toContain('Wszystkie');
  });
});
