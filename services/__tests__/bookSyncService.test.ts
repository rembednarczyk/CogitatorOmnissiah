import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookSyncService } from '../bookSyncService';
import { NotionAdapter } from '../../notion.adapter';
import { WikiAdapter } from '../../wiki.adapter';
import { Book, NotionBook } from '../../src/types';

describe('BookSyncService', () => {
  let service: BookSyncService;
  let mockNotion: any;
  let mockWiki: any;
  let mockSendEvent: any;

  beforeEach(() => {
    mockNotion = {
      init: vi.fn(),
      queryAllBooks: vi.fn(),
      updatePage: vi.fn(),
      addRow: vi.fn(),
    };

    mockWiki = {
      fetchPageContent: vi.fn(),
    };

    mockSendEvent = vi.fn();

    service = new BookSyncService(mockNotion as unknown as NotionAdapter, mockWiki as unknown as WikiAdapter);
  });

  describe('fetchBooksFromMediaWiki', () => {
    it('parses wiki table and returns books', async () => {
      const wikitext = `
{| class="wikitable"
|-
! Rok 
! Autor 
! Tytuł oryginalny 
! Tytuł polski
|- style="background: #ccffcc"
| [[1961]] || [[Stanisław Lem]] || ''Solaris'' || Solaris
|}`;
      mockWiki.fetchPageContent.mockResolvedValue(wikitext);

      const books = await service.fetchBooksFromMediaWiki('Test Page', 'Nagroda Test', mockSendEvent);

      expect(books).toHaveLength(1);
      expect(books[0]).toEqual(expect.objectContaining({
        year: '1961',
        author: 'Stanisław Lem',
        originalTitle: 'Solaris',
        polishTitle: 'Solaris',
        award: 'Nagroda Test'
      }));
    });
  });

  describe('compareBooks', () => {
    it('returns updates when titles differ', () => {
      const existing: NotionBook = {
        id: '1',
        plTitle: 'Stary',
        origTitle: '', // Empty to trigger update
        author: 'Lem',
        year: '2000',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      };
      const newBook: Book = {
        polishTitle: 'Nowy',
        originalTitle: 'New',
        author: 'Lem',
        year: '2000',
        award: 'Test',
        polishTitleLink: null
      };

      const updates = service.compareBooks(existing, newBook);

      expect(updates).toHaveProperty('Tytuł polski');
      expect(updates).toHaveProperty('Tytuł oryginalny');
    });

    it('returns empty object when books are identical', () => {
      const existing: NotionBook = {
        id: '1',
        plTitle: 'Solaris',
        origTitle: 'Solaris',
        author: 'Stanisław Lem',
        year: '1961',
        awards: ['Nagroda Test'],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      };
      const newBook: Book = {
        polishTitle: 'Solaris',
        originalTitle: 'Solaris',
        author: 'Stanisław Lem',
        year: '1961',
        award: 'Nagroda Test',
        awards: ['Nagroda Test'],
        polishTitleLink: null
      };

      const updates = service.compareBooks(existing, newBook);

      expect(updates).toEqual({});
    });

    it('merges authors instead of replacing manually added ones', () => {
      const existing: NotionBook = {
        id: '1',
        plTitle: 'Diuna',
        origTitle: 'Dune',
        author: 'Frank Herbert, Brian Herbert',
        year: '1965',
        awards: ['Nagroda Hugo'],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      };
      const newBook: Book = {
        polishTitle: 'Diuna',
        originalTitle: 'Dune',
        author: 'Frank Herbert',
        year: '1965',
        award: 'Nagroda Hugo',
        awards: ['Nagroda Hugo'],
        polishTitleLink: null
      };

      const updates = service.compareBooks(existing, newBook);

      // Wiki has fewer authors than Notion — nothing to add, nothing removed
      expect(updates).not.toHaveProperty('Autor');
    });

    it('adds new wiki authors while keeping existing ones', () => {
      const existing: NotionBook = {
        id: '1',
        plTitle: 'Diuna',
        origTitle: 'Dune',
        author: 'Frank Herbert',
        year: '1965',
        awards: ['Nagroda Hugo'],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      };
      const newBook: Book = {
        polishTitle: 'Diuna',
        originalTitle: 'Dune',
        author: 'Frank Herbert, Kevin J. Anderson',
        year: '1965',
        award: 'Nagroda Hugo',
        awards: ['Nagroda Hugo'],
        polishTitleLink: null
      };

      const updates = service.compareBooks(existing, newBook);

      expect(updates).toHaveProperty('Autor');
      const names = updates['Autor'].multi_select.map((o: any) => o.name);
      expect(names).toContain('Frank Herbert');
      expect(names).toContain('Kevin J. Anderson');
    });

    it('is idempotent when Notion stores a different-case author (no churny re-updates)', () => {
      // Notion keeps its own option casing ("van Vogt"); wiki normalizes to
      // "Van Vogt". These are the same author — must NOT trigger an update.
      const existing: NotionBook = {
        id: '1',
        plTitle: 'Slan',
        origTitle: 'Slan',
        author: 'A. E. van Vogt', // stored casing from Notion
        year: '1941',
        awards: ['Nagroda Hugo'],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      };
      const newBook: Book = {
        polishTitle: 'Slan',
        originalTitle: 'Slan',
        author: 'A. E. Van Vogt', // wiki-normalized casing
        year: '1941',
        award: 'Nagroda Hugo',
        awards: ['Nagroda Hugo'],
        polishTitleLink: null
      };

      const updates = service.compareBooks(existing, newBook);
      expect(updates).not.toHaveProperty('Autor');
    });

    it('is idempotent for a multi-author book with mixed casing', () => {
      const existing: NotionBook = {
        id: '1',
        plTitle: 'The Winged Man',
        origTitle: 'The Winged Man',
        author: 'A. E. van Vogt, Edna Mayne Hull',
        year: '1945',
        awards: ['Nagroda Hugo'],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      };
      const newBook: Book = {
        polishTitle: 'The Winged Man',
        originalTitle: 'The Winged Man',
        author: 'A. E. Van Vogt, Edna Mayne Hull',
        year: '1945',
        award: 'Nagroda Hugo',
        awards: ['Nagroda Hugo'],
        polishTitleLink: null
      };

      const updates = service.compareBooks(existing, newBook);
      expect(updates).not.toHaveProperty('Autor');
    });
  });

  describe('runBookSync', () => {
    it('syncs books correctly', async () => {
      mockWiki.fetchPageContent.mockResolvedValue(`
{| class="wikitable"
|-
! Rok 
! Autor 
! Tytuł oryginalny 
! Tytuł polski
|-
| [[1961]] || [[Stanisław Lem]] || ''Solaris'' || Solaris
|}`);
      
      mockNotion.queryAllBooks.mockResolvedValue([]);

      await service.runBookSync({ pageTitle: 'Test', awardName: 'Nagroda Test' }, mockSendEvent, () => false);

      expect(mockNotion.addRow).toHaveBeenCalledTimes(1);
      expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete' }));
    });

    it('handles cancellation', async () => {
      mockWiki.fetchPageContent.mockResolvedValue('Some content');
      await service.runBookSync({ pageTitle: 'Test', awardName: 'Nagroda Test' }, mockSendEvent, () => true);

      expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', error: 'Synchronizacja przerwana przez użytkownika.' }));
      expect(mockNotion.addRow).not.toHaveBeenCalled();
    });
  });
});
