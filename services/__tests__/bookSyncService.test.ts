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
