import { fakeConfig } from "./testConfig";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CyclesSyncService } from '../cyclesSyncService';
import { NotionAdapter } from '../../notion.adapter';
import { WikiAdapter } from '../../wiki.adapter';
import { NotionBook } from '../../src/types';

describe('CyclesSyncService', () => {
  let service: CyclesSyncService;
  let mockNotion: any;
  let mockWiki: any;
  let mockSendEvent: any;

  beforeEach(() => {
    mockNotion = {
      createColumnIfNeeded: vi.fn(),
      queryAllBooks: vi.fn(),
      updatePage: vi.fn(),
    };

    mockWiki = {
      fetchPagesContentBulk: vi.fn(),
      searchPage: vi.fn(),
      fetchPageContent: vi.fn(),
    };

    mockSendEvent = vi.fn();

    service = new CyclesSyncService(mockNotion as unknown as NotionAdapter, mockWiki as unknown as WikiAdapter, fakeConfig);
  });

  it('updates cycle checkbox when it differs', async () => {
    const mockBooks: NotionBook[] = [
      {
        id: 'page-1',
        plTitle: 'Solaris',
        origTitle: 'Solaris',
        author: 'Stanisław Lem',
        year: '1961',
        currentCzesccyklu: false,
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      }
    ];

    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({
      contents: {
        'solaris': '{{Książka infobox\n|autor = Stanisław Lem\n|cykl = Opowieści o pilocie Pirxie\n}}'
      },
      failedTitles: []
    });

    await service.runCyclesSync(mockSendEvent, () => false);

    expect(mockNotion.updatePage).toHaveBeenCalledWith('page-1', {
      'Część cyklu': { checkbox: true }
    });
    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete' }));
  });

  const bookOf = (over: Partial<NotionBook>): NotionBook => ({
    id: 'p', plTitle: 'T', origTitle: 'T', author: 'A', year: '2000',
    currentCzesccyklu: false, awards: [], zrodlo: [], currentWydawnictwo: '',
    currentSeria: '', lp: '1', plTitleRichText: [], origTitleRichText: [], ...over,
  });

  it('marks cycle from real {{Książka}} raw with |cykl= filled (Inny / Childe)', async () => {
    const raw = `{{Książka\n | tytuł = Inny\n | autor = Gordon R. Dickson\n | seria = Kanon science fiction\n | cykl = Childe\n | poprzednia = Młody Bleys\n | następna = Gildia Orędowników\n}}`;
    mockNotion.queryAllBooks.mockResolvedValue([bookOf({ id: 'inny', plTitle: 'Inny', origTitle: 'Other', author: 'Gordon R. Dickson' })]);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({ contents: { 'inny': raw }, failedTitles: [] });

    await service.runCyclesSync(mockSendEvent, () => false);

    expect(mockNotion.updatePage).toHaveBeenCalledWith('inny', { 'Część cyklu': { checkbox: true } });
  });

  it('does NOT mark cycle when only |seria= is present (publisher imprint, no |cykl=)', async () => {
    const raw = `{{Książka\n | autor = Jan Kowalski\n | seria = Uczta Wyobraźni\n | cykl = \n}}`;
    mockNotion.queryAllBooks.mockResolvedValue([bookOf({ id: 'p1', plTitle: 'Solo', author: 'Jan Kowalski' })]);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({ contents: { 'solo': raw }, failedTitles: [] });

    await service.runCyclesSync(mockSendEvent, () => false);

    expect(mockNotion.updatePage).not.toHaveBeenCalled();
  });

  it('detects cycle from a bare {{Cykl}} navigation template (no |cykl= field)', async () => {
    const raw = `{{Książka\n | autor = Anna Nowak\n}}\nTekst.\n{{Cykl nawigacja|Saga X}}`;
    mockNotion.queryAllBooks.mockResolvedValue([bookOf({ id: 'p2', plTitle: 'Tom I', author: 'Anna Nowak' })]);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({ contents: { 'tom i': raw }, failedTitles: [] });

    await service.runCyclesSync(mockSendEvent, () => false);

    expect(mockNotion.updatePage).toHaveBeenCalledWith('p2', { 'Część cyklu': { checkbox: true } });
  });

  it('skips cycle-volume rows (Kategoria="Tom cyklu") — they are not re-evaluated', async () => {
    const raw = `{{Książka\n | autor = Anna Nowak\n | cykl = Saga\n}}`;
    mockNotion.queryAllBooks.mockResolvedValue([
      bookOf({ id: 'award', plTitle: 'Nagroda', author: 'Anna Nowak' }),
      bookOf({ id: 'vol', plTitle: 'Poboczny Tom', author: 'Anna Nowak', kategoria: 'Tom cyklu' }),
    ]);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({
      contents: { 'nagroda': raw, 'poboczny tom': raw },
      failedTitles: [],
    });

    await service.runCyclesSync(mockSendEvent, () => false);

    // The cycle volume must never be re-tagged; only the award anchor is processed.
    expect(mockNotion.updatePage).toHaveBeenCalledTimes(1);
    expect(mockNotion.updatePage).toHaveBeenCalledWith('award', { 'Część cyklu': { checkbox: true } });
    const complete = mockSendEvent.mock.calls.map((c: any[]) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete.result.found).toBe(1);
  });

  it('reports a book as skipped (not silently) when no wiki page is found', async () => {
    mockNotion.queryAllBooks.mockResolvedValue([bookOf({ id: 'p3', plTitle: 'Widmo', author: 'Zenon Test' })]);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({ contents: {}, failedTitles: [] });
    mockWiki.searchPage.mockResolvedValue([]);
    mockWiki.fetchPageContent.mockResolvedValue('');

    await service.runCyclesSync(mockSendEvent, () => false);

    expect(mockNotion.updatePage).not.toHaveBeenCalled();
    const complete = mockSendEvent.mock.calls.map((c: any[]) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete.result.skipped).toBe(1);
    expect(complete.result.summary.skipped[0]).toContain('Widmo');
    expect(complete.result.summary.skipped[0]).toContain('nie znaleziono strony');
  });

  it('reports a book as skipped with author-mismatch reason when the page exists but author differs', async () => {
    const raw = `{{Książka\n | autor = Zupełnie Inny Autor\n | cykl = Jakiś\n}}`;
    mockNotion.queryAllBooks.mockResolvedValue([bookOf({ id: 'p4', plTitle: 'Kolizja', author: 'Prawdziwy Pisarz' })]);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({ contents: { 'kolizja': raw }, failedTitles: [] });
    mockWiki.searchPage.mockResolvedValue([]);
    mockWiki.fetchPageContent.mockResolvedValue('');

    await service.runCyclesSync(mockSendEvent, () => false);

    expect(mockNotion.updatePage).not.toHaveBeenCalled();
    const complete = mockSendEvent.mock.calls.map((c: any[]) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete.result.summary.skipped[0]).toContain('autor się nie zgadza');
  });
});
