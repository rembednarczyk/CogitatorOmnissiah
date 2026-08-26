// @vitest-environment node
import { fakeConfig } from "./testConfig";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { VintedSyncService } from '../vintedSyncService';
import { NotionAdapter } from '../../notion.adapter';

const mockedGet = axios.get as unknown as ReturnType<typeof vi.fn>;

// Vinted catalog blob (data-props uses &quot;-escaped JSON, as in the real page)
const CATALOG_HTML = (json: object) =>
  `<html><body><div data-component-name="Catalog" data-props="${JSON.stringify(json)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')}"></div></body></html>`;

const NO_RESULTS_HTML = `<html><body>Nie znaleźliśmy żadnych przedmiotów</body></html>`;

function makeNotion(books: any[]) {
  return {
    getBooksForStats: vi.fn().mockResolvedValue(books),
  } as unknown as NotionAdapter;
}

describe('VintedSyncService', () => {
  let sendEvent: any;
  const never = () => false;

  beforeEach(() => {
    vi.clearAllMocks();
    sendEvent = vi.fn();
    // Collapse the anti-block delays so the loop runs instantly in tests
    vi.spyOn(global, 'setTimeout').mockImplementation(((fn: any) => { fn(); return 0 as any; }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits a match with parsed items when the catalog JSON contains a relevant offer', async () => {
    const notion = makeNotion([
      { id: '1', plTitle: 'Solaris', author: 'Lem', zrodlo: [] },
    ]);
    mockedGet.mockResolvedValue({
      data: CATALOG_HTML({
        items: { list: [{ id: 123, title: 'Solaris Lem', price: { amount: '15', currency_code: 'PLN' }, url: '/items/123' }] },
      }),
    });

    const svc = new VintedSyncService(notion, fakeConfig);
    await svc.runVintedCheck(sendEvent, never);

    const events = sendEvent.mock.calls.map((c: any) => c[0]);
    const match = events.find((e: any) => e.type === 'match');
    expect(match).toBeDefined();
    expect(match.result.vintedItems).toHaveLength(1);
    expect(match.result.vintedItems[0].url).toBe('https://www.vinted.pl/items/123');

    const complete = events.find((e: any) => e.type === 'complete');
    expect(complete.result.results).toHaveLength(1);
    const success = events.find((e: any) => e.type === 'search_attempt' && e.result.status === 'success');
    expect(success?.result.itemCount).toBe(1);
  });

  it('emits a no_results search_attempt when Vinted finds nothing', async () => {
    const notion = makeNotion([
      { id: '1', plTitle: 'Solaris', author: 'Lem', zrodlo: [] },
    ]);
    mockedGet.mockResolvedValue({ data: NO_RESULTS_HTML });

    const svc = new VintedSyncService(notion, fakeConfig);
    await svc.runVintedCheck(sendEvent, never);

    const events = sendEvent.mock.calls.map((c: any) => c[0]);
    const noResults = events.filter((e: any) => e.type === 'search_attempt' && e.result.status === 'no_results');
    expect(noResults.length).toBeGreaterThan(0);
    const complete = events.find((e: any) => e.type === 'complete');
    expect(complete.result.results).toHaveLength(0);
  });

  it('excludes owned/read books from the candidate set', async () => {
    const notion = makeNotion([
      { id: '1', plTitle: 'Solaris', author: 'Lem', zrodlo: ['Posiadam'] },
      { id: '2', plTitle: 'Diuna', author: 'Herbert', zrodlo: ['Przeczytane'] },
    ]);
    mockedGet.mockResolvedValue({ data: NO_RESULTS_HTML });

    const svc = new VintedSyncService(notion, fakeConfig);
    await svc.runVintedCheck(sendEvent, never);

    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('self-heals: drops a primed session that serves a structureless page, still collects books', async () => {
    const notion = makeNotion([
      { id: '1', plTitle: 'Solaris', author: 'Lem', zrodlo: [] },
    ]);
    mockedGet
      // 1) priming homepage — sets a cookie → session is primed
      .mockResolvedValueOnce({ status: 200, data: '<html></html>', headers: { 'set-cookie': ['cf_clearance=x; Path=/'] } })
      // 2) validation probe — structureless page (no catalog / feed-grid / /items/ / no-results)
      .mockResolvedValueOnce({ data: '<html><body>brak katalogu tutaj</body></html>' })
      // 3+) real catalog scan (unprimed after fallback) — a parseable offer
      .mockResolvedValue({ data: CATALOG_HTML({ items: { list: [{ id: 123, title: 'Solaris Lem', price: { amount: '15', currency_code: 'PLN' }, url: '/items/123' }] } }) });

    const svc = new VintedSyncService(notion, fakeConfig);
    await svc.runVintedCheck(sendEvent, never);

    const events = sendEvent.mock.calls.map((c: any) => c[0]);
    expect(events.some((e: any) => e.type === 'status' && /porzucam priming/i.test(e.message || ''))).toBe(true);
    const match = events.find((e: any) => e.type === 'match');
    expect(match).toBeDefined();
    expect(match.result.vintedItems).toHaveLength(1);
  });
});
