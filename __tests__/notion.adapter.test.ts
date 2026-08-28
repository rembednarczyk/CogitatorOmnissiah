import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@notionhq/client';

const mockClient = {
  databases: {
    retrieve: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
  },
  dataSources: {
    retrieve: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
  },
  pages: {
    retrieve: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  }
};

vi.mock('@notionhq/client', () => {
  return {
    Client: class {
      constructor() {
        return mockClient;
      }
    }
  };
});

import { NotionAdapter } from '../notion.adapter';

describe('NotionAdapter', () => {
  let adapter: NotionAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NotionAdapter('test-key', 'test-db-id');
  });

  describe('init', () => {
    it('initializes as data source if possible', async () => {
      mockClient.dataSources.retrieve.mockResolvedValueOnce({ id: 'test-db-id' });
      
      await adapter.init();
      
      expect(mockClient.dataSources.retrieve).toHaveBeenCalledWith({ data_source_id: 'test-db-id' });
      expect((adapter as any).isDataSource).toBe(true);
      expect((adapter as any).actualDataSourceId).toBe('test-db-id');
    });

    it('falls back to database if data source retrieve fails', async () => {
      mockClient.dataSources.retrieve.mockRejectedValueOnce(new Error('Not found'));
      mockClient.databases.retrieve.mockResolvedValueOnce({ id: 'test-db-id', data_sources: [] });
      
      await adapter.init();
      
      expect(mockClient.databases.retrieve).toHaveBeenCalledWith({ database_id: 'test-db-id' });
      expect((adapter as any).isDataSource).toBe(false);
      expect((adapter as any).actualDataSourceId).toBe('test-db-id');
    });

    it('uses data source from database if available', async () => {
      mockClient.dataSources.retrieve.mockRejectedValueOnce(new Error('Not found'));
      mockClient.databases.retrieve.mockResolvedValueOnce({ 
        id: 'test-db-id', 
        data_sources: [{ id: 'ds-123' }] 
      });
      
      await adapter.init();
      
      expect((adapter as any).isDataSource).toBe(true);
      expect((adapter as any).actualDataSourceId).toBe('ds-123');
    });
  });

  describe('getSchema', () => {
    it('returns schema from data source', async () => {
      mockClient.dataSources.retrieve.mockResolvedValueOnce({ id: 'test-db-id' }); // for init
      mockClient.dataSources.retrieve.mockResolvedValueOnce({ properties: { 'Tytuł': {} } }); // for getSchema
      
      const schema = await adapter.getSchema();
      expect(schema).toEqual({ 'Tytuł': {} });
    });
  });

  describe('queryAllBooks', () => {
    it('queries all books and parses them correctly', async () => {
      mockClient.dataSources.retrieve.mockResolvedValueOnce({ id: 'test-db-id' }); // for init
      
      const mockPage = {
        id: 'page-1',
        properties: {
          'Tytuł polski': { type: 'title', title: [{ plain_text: 'Solaris' }] },
          'Autor': { type: 'rich_text', rich_text: [{ plain_text: 'Stanisław Lem' }] },
          'Rok': { type: 'number', number: 1961 },
          'Nagroda': { type: 'multi_select', multi_select: [{ name: 'Zajdel' }] }
        }
      };
      
      mockClient.dataSources.query.mockResolvedValueOnce({
        results: [mockPage],
        has_more: false
      });

      const books = await adapter.queryAllBooks();
      
      expect(books).toHaveLength(1);
      expect(books[0]).toEqual(expect.objectContaining({
        id: 'page-1',
        plTitle: 'Solaris',
        author: 'Stanisław Lem',
        year: '1961',
        awards: ['Zajdel']
      }));
    });
  });

  describe('getBooksForStats caching', () => {
    const page = (id: string) => ({
      id,
      properties: { 'Tytuł polski': { type: 'title', title: [{ plain_text: `T-${id}` }] } },
    });

    it('shares one Notion fetch across cached reads until invalidated', async () => {
      mockClient.dataSources.retrieve.mockResolvedValue({ id: 'test-db-id' }); // init
      mockClient.dataSources.query.mockResolvedValue({ results: [page('1')], has_more: false });

      // The first scan fetches from Notion...
      const first = await adapter.getBooksForStats(undefined, undefined, { cache: true });
      // ...the second (e.g. another branch) uses the cache — no new query.
      const second = await adapter.getBooksForStats(undefined, undefined, { cache: true });

      expect(first).toHaveLength(1);
      expect(second).toEqual(first);
      expect(mockClient.dataSources.query).toHaveBeenCalledTimes(1);
    });

    it('does not serve the cache to non-cached (stats) reads', async () => {
      mockClient.dataSources.retrieve.mockResolvedValue({ id: 'test-db-id' });
      mockClient.dataSources.query.mockResolvedValue({ results: [page('1')], has_more: false });

      await adapter.getBooksForStats(undefined, undefined, { cache: true }); // primes cache
      await adapter.getBooksForStats(); // stats path — must fetch fresh

      expect(mockClient.dataSources.query).toHaveBeenCalledTimes(2);
    });

    it('invalidates the cache after a write (addTagToMultiSelect)', async () => {
      mockClient.dataSources.retrieve.mockResolvedValue({ id: 'test-db-id' });
      mockClient.dataSources.query.mockResolvedValue({ results: [page('1')], has_more: false });
      mockClient.pages.retrieve.mockResolvedValue({ properties: { 'Źródło': { type: 'multi_select', multi_select: [] } } });
      mockClient.pages.update.mockResolvedValue({});

      await adapter.getBooksForStats(undefined, undefined, { cache: true }); // primes cache
      await adapter.addTagToMultiSelect('page-1', 'Źródło', 'Biblioteka'); // invalidates
      await adapter.getBooksForStats(undefined, undefined, { cache: true }); // must refetch

      expect(mockClient.dataSources.query).toHaveBeenCalledTimes(2);
    });

    it('does not cache a fetch cut short by cancellation', async () => {
      mockClient.dataSources.retrieve.mockResolvedValue({ id: 'test-db-id' });
      mockClient.dataSources.query.mockResolvedValue({ results: [page('1')], has_more: false });

      await adapter.getBooksForStats(undefined, () => true, { cache: true }); // cancelled → no cache
      await adapter.getBooksForStats(undefined, undefined, { cache: true });   // must fetch

      expect(mockClient.dataSources.query).toHaveBeenCalledTimes(1); // first call broke before querying
    });
  });

  describe('updateDatabaseProperty', () => {
    it('updates a property correctly', async () => {
      mockClient.dataSources.retrieve.mockResolvedValueOnce({ id: 'test-db-id' }); // for init

      await adapter.updateDatabaseProperty('Wydawnictwo', 'rich_text');

      expect(mockClient.dataSources.update).toHaveBeenCalledWith({
        data_source_id: 'test-db-id',
        properties: {
          'Wydawnictwo': {
            rich_text: {}
          }
        }
      });
    });
  });

  describe('setReadDate', () => {
    it('stamps a calendar-day date on the page', async () => {
      mockClient.pages.update.mockResolvedValue({});

      await adapter.setReadDate('page-1', '2024-01-15');

      expect(mockClient.pages.update).toHaveBeenCalledWith({
        page_id: 'page-1',
        properties: { 'Data przeczytania': { date: { start: '2024-01-15' } } },
      });
    });

    it('clears the date when passed null', async () => {
      mockClient.pages.update.mockResolvedValue({});

      await adapter.setReadDate('page-1', null);

      expect(mockClient.pages.update).toHaveBeenCalledWith({
        page_id: 'page-1',
        properties: { 'Data przeczytania': { date: null } },
      });
    });

    it('invalidates the books cache after the write', async () => {
      const page1 = { id: '1', properties: { 'Tytuł polski': { type: 'title', title: [{ plain_text: 'T-1' }] } } };
      mockClient.dataSources.retrieve.mockResolvedValue({ id: 'test-db-id' });
      mockClient.dataSources.query.mockResolvedValue({ results: [page1], has_more: false });
      mockClient.pages.update.mockResolvedValue({});

      await adapter.getBooksForStats(undefined, undefined, { cache: true }); // primes cache
      await adapter.setReadDate('page-1', '2024-01-15');                     // invalidates
      await adapter.getBooksForStats(undefined, undefined, { cache: true }); // must refetch

      expect(mockClient.dataSources.query).toHaveBeenCalledTimes(2);
    });
  });
});
