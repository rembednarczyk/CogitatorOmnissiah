import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeConfig } from "./testConfig";
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

    service = new StatsService(mockNotion as unknown as NotionAdapter, fakeConfig);
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

  it('partitions unread availability by priority (owned > library > vinted > none)', async () => {
    const vintedBlob = JSON.stringify({ scannedAt: "2026-01-01", offers: [{ id: "o", url: "https://vinted.pl/items/1", price: 10 }] });
    const mk = (id: string, zrodlo: string[], vintedData?: string): NotionBook => ({
      id, plTitle: `T${id}`, origTitle: "", author: "A", year: "1970", zrodlo, awards: [],
      currentWydawnictwo: "", currentSeria: "", currentCzesccyklu: false, lp: id,
      plTitleRichText: [], origTitleRichText: [], vintedData,
    });
    mockNotion.getBooksForStats.mockResolvedValue([
      mk("1", ["Przeczytane"]),                    // przeczytana — poza licznikiem
      mk("2", ["Posiadam"]),                       // owned
      mk("3", ["Biblioteka"]),                     // library (default sourceTag)
      mk("4", [], vintedBlob),                     // vinted
      mk("5", []),                                 // none
      mk("6", ["Posiadam", "Biblioteka"], vintedBlob), // owned wygrywa priorytet
    ]);

    const { availabilityStats: a } = await service.getStats();
    expect(a).toEqual({ totalUnread: 5, owned: 2, library: 1, vinted: 1, none: 1 });
  });

  it('builds libraryStats from config branches (id = sourceTag)', async () => {
    mockNotion.getBooksForStats.mockResolvedValue([
      { id: "1", plTitle: "X", origTitle: "", author: "A", year: "1970", zrodlo: ["Biblioteka"], awards: [], currentWydawnictwo: "", currentSeria: "", currentCzesccyklu: false, lp: "1", plTitleRichText: [], origTitleRichText: [] } as NotionBook,
    ]);
    const { libraryStats } = await service.getStats();
    expect(libraryStats.map(l => l.id)).toEqual(["Biblioteka", "Biblioteka 9"]);
    expect(libraryStats[0].books).toHaveLength(1);
    expect(libraryStats[1].books).toHaveLength(0);
  });
});
