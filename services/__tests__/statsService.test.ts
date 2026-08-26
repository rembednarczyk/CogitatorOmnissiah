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

  it('excludes cycle-volume rows (Kategoria=Tom cyklu) from award stats', async () => {
    const base = { origTitle: '', author: 'Autor X', year: '1980', currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, plTitleRichText: [], origTitleRichText: [] };
    mockNotion.getBooksForStats.mockResolvedValue([
      { ...base, id: '1', plTitle: 'Nagrodzona', zrodlo: ['Przeczytane'], awards: ['Nagroda Hugo'], lp: '1' },
      { ...base, id: '2', plTitle: 'Poboczny tom', zrodlo: ['Przeczytane'], awards: [], lp: '2', kategoria: 'Tom cyklu' },
    ] as NotionBook[]);

    const stats = await service.getStats();
    // Only the award entry is counted; the cycle volume is skipped in awardBooks and authors.
    expect(stats.awardBooksStats).toEqual({ read: 1, total: 1 });
    expect(stats.authorStats).toEqual([expect.objectContaining({ name: 'Autor X', total: 1 })]);
  });

  it('partitions unread availability by priority (owned > library > vinted > none)', async () => {
    const vintedBlob = JSON.stringify({ scannedAt: "2026-01-01", offers: [{ id: "o", url: "https://vinted.pl/items/1", price: 10 }] });
    const mk = (id: string, zrodlo: string[], vintedData?: string): NotionBook => ({
      id, plTitle: `T${id}`, origTitle: "", author: "A", year: "1970", zrodlo, awards: [],
      currentWydawnictwo: "", currentSeria: "", currentCzesccyklu: false, lp: id,
      plTitleRichText: [], origTitleRichText: [], vintedData,
    });
    mockNotion.getBooksForStats.mockResolvedValue([
      mk("1", ["Przeczytane"]),                    // read — excluded from the counter
      mk("2", ["Posiadam"]),                       // owned
      mk("3", ["Biblioteka"]),                     // library (default sourceTag)
      mk("4", [], vintedBlob),                     // vinted
      mk("5", []),                                 // none
      mk("6", ["Posiadam", "Biblioteka"], vintedBlob), // owned wins priority
    ]);

    const { availabilityStats: a } = await service.getStats();
    expect(a).toEqual({ totalUnread: 5, owned: 2, library: 1, vinted: 1, none: 1 });
  });

  it('aggregates publishers / series / cycles from their fields', async () => {
    const mk = (id: string, over: Partial<NotionBook>): NotionBook => ({
      id, plTitle: `T${id}`, origTitle: "", author: "A", year: "1970", zrodlo: [], awards: [],
      currentWydawnictwo: "", currentSeria: "", currentCzesccyklu: false, lp: id,
      plTitleRichText: [], origTitleRichText: [], ...over,
    });
    mockNotion.getBooksForStats.mockResolvedValue([
      mk("1", { currentWydawnictwo: "MAG", currentSeria: "Uczta Wyobraźni", currentCzesccyklu: true, zrodlo: ["Posiadam", "Przeczytane"] }),
      mk("2", { currentWydawnictwo: "MAG", currentSeria: "Uczta Wyobraźni", currentCzesccyklu: true, zrodlo: ["Posiadam"] }),
      mk("3", { currentWydawnictwo: "Rebis", currentSeria: "", currentCzesccyklu: false }),
    ]);
    const { publisherStats, seriesStats, cycleStats } = await service.getStats();
    expect(publisherStats[0]).toEqual({ name: "MAG", count: 2, read: 1 });
    expect(publisherStats.find(p => p.name === "Rebis")).toEqual({ name: "Rebis", count: 1, read: 0 });
    expect(seriesStats[0]).toEqual({ name: "Uczta Wyobraźni", count: 2, owned: 2, read: 1 });
    expect(cycleStats).toEqual({ partOfCycle: 2, standalone: 1, total: 3 });
  });

  it('rolls years up into decades (read/owned, first 4-digit year)', async () => {
    const mk = (id: string, year: string, zrodlo: string[] = []): NotionBook => ({
      id, plTitle: `T${id}`, origTitle: "", author: "A", year, zrodlo, awards: [],
      currentWydawnictwo: "", currentSeria: "", currentCzesccyklu: false, lp: id,
      plTitleRichText: [], origTitleRichText: [],
    });
    mockNotion.getBooksForStats.mockResolvedValue([
      mk("1", "1954", ["Przeczytane"]),
      mk("2", "1959", ["Posiadam"]),
      mk("3", "1965/1966"),        // multi-dated → 1960
      mk("4", "brak"),             // no year → skipped
    ]);
    const { decadeStats } = await service.getStats();
    expect(decadeStats).toEqual([
      { decade: 1950, total: 2, read: 1, owned: 1 },
      { decade: 1960, total: 1, read: 0, owned: 0 },
    ]);
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
