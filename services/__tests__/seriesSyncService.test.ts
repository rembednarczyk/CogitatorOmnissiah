import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SeriesSyncService } from '../seriesSyncService';
import { NotionAdapter } from '../../notion.adapter';
import { WikiAdapter } from '../../wiki.adapter';
import { NotionBook } from '../../src/types';

describe('SeriesSyncService', () => {
  let service: SeriesSyncService;
  let mockNotion: any;
  let mockWiki: any;
  let mockSendEvent: any;

  beforeEach(() => {
    mockNotion = {
      queryAllBooks: vi.fn(),
      updatePage: vi.fn(),
      buildPropertyValue: vi.fn((val, type) => ({ [type]: val })),
    };

    mockWiki = {
      fetchPagesContentBulk: vi.fn(),
    };

    mockSendEvent = vi.fn();

    service = new SeriesSyncService(mockNotion as unknown as NotionAdapter, mockWiki as unknown as WikiAdapter);
  });

  it('updates series when it differs', async () => {
    const mockBooks: NotionBook[] = [
      {
        id: 'page-1',
        plTitle: 'Solaris',
        origTitle: 'Solaris',
        author: 'Stanisław Lem',
        year: '1961',
        currentSeria: 'Stara Seria',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      }
    ];

    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({
      'solaris': '{{Książka infobox\n|seria = Nowa Seria\n}}'
    });

    await service.runSeriesSync(mockSendEvent, () => false);

    expect(mockNotion.updatePage).toHaveBeenCalledWith('page-1', {
      'Seria': expect.anything()
    });
    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete' }));
  });
});
