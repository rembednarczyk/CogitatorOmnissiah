import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatsService } from '../statsService';
import { NotionAdapter } from '../../notion.adapter';
import { NotionBook } from '../../src/types';

describe('StatsService', () => {
  let service: StatsService;
  let mockNotion: any;

  beforeEach(() => {
    mockNotion = {
      getBooksForStats: vi.fn(),
    };

    service = new StatsService(mockNotion as unknown as NotionAdapter);
  });

  it('calculates stats correctly', async () => {
    const mockBooks: NotionBook[] = [
      {
        id: '1',
        plTitle: 'Solaris',
        author: 'Stanisław Lem',
        origTitle: 'Solaris',
        year: '1961',
        zrodlo: ['Przeczytane', 'Posiadam'],
        awards: ['Nagroda Hugo'],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      },
      {
        id: '2',
        plTitle: 'Cyberiada',
        author: 'Stanisław Lem',
        origTitle: 'Cyberiada',
        year: '1965',
        zrodlo: ['Posiadam'],
        awards: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '2',
        plTitleRichText: [],
        origTitleRichText: []
      }
    ];

    mockNotion.getBooksForStats.mockResolvedValue(mockBooks);

    const stats = await service.getStats();

    expect(stats.awardBooksStats).toEqual({ read: 1, total: 2 });
    expect(stats.authorStats).toContainEqual(expect.objectContaining({
      name: 'Stanisław Lem',
      read: 1,
      total: 2
    }));
    expect(stats.ownedUnread).toHaveLength(1);
    expect(stats.ownedUnread[0].title).toBe('Cyberiada');
  });
});
