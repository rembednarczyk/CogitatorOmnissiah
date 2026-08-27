import { fakeConfig } from "./testConfig";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrityService } from '../integrityService';
import { ConfigService } from '../configService';
import { mergeConfig } from '../../src/configSchema';
import { NotionAdapter } from '../../notion.adapter';
import { WikiAdapter } from '../../wiki.adapter';
import { NotionBook, Book } from '../../src/types';

describe('IntegrityService', () => {
  let service: IntegrityService;
  let mockNotion: any;
  let mockWiki: any;
  let mockSendEvent: any;

  beforeEach(() => {
    mockNotion = {
      init: vi.fn(),
      queryAllBooks: vi.fn(),
    };

    mockWiki = {
      fetchPageContent: vi.fn(),
    };

    mockSendEvent = vi.fn();

    service = new IntegrityService(mockNotion as unknown as NotionAdapter, mockWiki as unknown as WikiAdapter, fakeConfig);
  });

  it('detects duplicate Lp values', async () => {
    const mockBooks: NotionBook[] = [
      { id: '1', lp: '1', plTitle: 'Book 1', author: 'Author', origTitle: '', year: '2000', awards: ['Nagroda Hugo'], zrodlo: [], currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, plTitleRichText: [], origTitleRichText: [] },
      { id: '2', lp: '1', plTitle: 'Book 2', author: 'Author', origTitle: '', year: '2000', awards: ['Nagroda Hugo'], zrodlo: [], currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, plTitleRichText: [], origTitleRichText: [] }
    ];

    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);
    mockWiki.fetchPageContent.mockResolvedValue(''); // No wiki books for simplicity

    await service.runIntegrityCheck(mockSendEvent, () => false);

    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'complete',
      result: expect.objectContaining({
        lpUniqueness: expect.objectContaining({ status: false, duplicates: expect.arrayContaining([expect.stringContaining('Lp 1')]) })
      })
    }));
  });

  it('detects duplicate original titles for the same author', async () => {
    const mockBooks: NotionBook[] = [
      { id: '1', lp: '1', plTitle: 'Solaris', author: 'Stanisław Lem', origTitle: 'Solaris', year: '1961', awards: ['Nagroda Hugo'], zrodlo: [], currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, plTitleRichText: [], origTitleRichText: [] },
      { id: '2', lp: '2', plTitle: 'Solaris', author: 'Stanisław Lem', origTitle: 'Solaris', year: '1961', awards: ['Nagroda Hugo'], zrodlo: [], currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, plTitleRichText: [], origTitleRichText: [] },
    ];
    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);
    mockWiki.fetchPageContent.mockResolvedValue('');

    await service.runIntegrityCheck(mockSendEvent, () => false);

    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'complete',
      result: expect.objectContaining({
        originalTitleUniqueness: expect.objectContaining({ status: false }),
        polishTitleUniqueness: expect.objectContaining({ status: false }),
      })
    }));
  });

  it('reports all checks clean when Notion mirrors the wiki', async () => {
    const mockNotionBooks: NotionBook[] = [
      { id: '1', lp: '1', plTitle: 'Solaris', author: 'Stanisław Lem', origTitle: 'Solaris', year: '1961', awards: ['Nagroda Hugo'], zrodlo: [], currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, plTitleRichText: [], origTitleRichText: [] },
    ];
    const wikiContent = `
{| class="wikitable"
|-
! Rok !! Autor !! Tytuł oryginalny !! Tytuł polski
|- style="background: #ccffcc"
| [[1961]] || [[Stanisław Lem]] || ''Solaris'' || Solaris
|}`;
    mockNotion.queryAllBooks.mockResolvedValue(mockNotionBooks);
    // Only the Hugo page returns a book; Nebula/Locus pages are empty.
    mockWiki.fetchPageContent.mockImplementation((title: string) =>
      Promise.resolve(title.toLowerCase().includes('hugo') ? wikiContent : '')
    );

    await service.runIntegrityCheck(mockSendEvent, () => false);

    const complete = mockSendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete.result.lpUniqueness.status).toBe(true);
    expect(complete.result.originalTitleUniqueness.status).toBe(true);
    expect(complete.result.yearCountMatch.status).toBe(true);
    expect(complete.result.awardCountMatch.status).toBe(true);
  });

  it('detects year mismatch between Notion and Wiki', async () => {
    const mockNotionBooks: NotionBook[] = [
      { id: '1', lp: '1', plTitle: 'Solaris', author: 'Stanisław Lem', origTitle: 'Solaris', year: '1961', awards: ['Nagroda Hugo'], zrodlo: [], currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, plTitleRichText: [], origTitleRichText: [] }
    ];

    const wikiContent = `
{| class="wikitable"
|-
! Rok !! Autor !! Tytuł oryginalny !! Tytuł polski
|-
| [[1962]] || [[Stanisław Lem]] || ''Solaris'' || Solaris
|}`;

    mockNotion.queryAllBooks.mockResolvedValue(mockNotionBooks);
    mockWiki.fetchPageContent.mockResolvedValue(wikiContent);

    await service.runIntegrityCheck(mockSendEvent, () => false);

    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'complete',
      result: expect.objectContaining({
        yearCountMatch: expect.objectContaining({ status: false })
      })
    }));
  });

  it('fetches the award pages from config (sync.awards), not a hardcoded list', async () => {
    // Config with a CUSTOM award page — the integrity check must fetch it.
    const customConfig = {
      getConfig: async () => mergeConfig({ sync: { awards: [{ name: "Nagroda BSFA", title: "BSFA nagroda powieść" }] } }),
    } as unknown as ConfigService;
    const svc = new IntegrityService(mockNotion as unknown as NotionAdapter, mockWiki as unknown as WikiAdapter, customConfig);

    mockNotion.queryAllBooks.mockResolvedValue([]);
    mockWiki.fetchPageContent.mockResolvedValue('');

    await svc.runIntegrityCheck(mockSendEvent, () => false);

    const titles = mockWiki.fetchPageContent.mock.calls.map((c: any) => c[0]);
    expect(titles).toContain("BSFA nagroda powieść");
    // ...and does NOT fetch the old hardcoded defaults that aren't in this config.
    expect(titles).not.toContain("Hugo nagroda powieść");
  });
});
