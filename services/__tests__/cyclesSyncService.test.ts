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
      resolveDataSourceId: vi.fn().mockResolvedValue('test-id'),
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

    service = new CyclesSyncService(mockNotion as unknown as NotionAdapter, mockWiki as unknown as WikiAdapter);
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
});
