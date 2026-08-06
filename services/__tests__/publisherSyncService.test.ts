import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublisherSyncService } from '../publisherSyncService';
import { NotionAdapter } from '../../notion.adapter';
import { WikiAdapter } from '../../wiki.adapter';
import { NotionBook } from '../../src/types';

describe('PublisherSyncService', () => {
  let service: PublisherSyncService;
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

    service = new PublisherSyncService(mockNotion as unknown as NotionAdapter, mockWiki as unknown as WikiAdapter);
  });

  it('updates publisher when it differs', async () => {
    const mockBooks: NotionBook[] = [
      {
        id: 'page-1',
        plTitle: 'Solaris',
        origTitle: 'Solaris',
        author: 'Stanisław Lem',
        year: '1961',
        currentWydawnictwo: 'Stare Wydawnictwo',
        awards: [],
        zrodlo: [],
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      }
    ];

    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);
    mockWiki.fetchPagesContentBulk.mockResolvedValue({
      'solaris': '{{Książka infobox\n|wydawca = Nowe Wydawnictwo\n}}'
    });

    await service.runPublisherSync(mockSendEvent, () => false);

    expect(mockNotion.updatePage).toHaveBeenCalledWith('page-1', {
      'Wydawnictwo': expect.anything()
    });
    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete' }));
  });

  it('handles cancellation', async () => {
    mockNotion.queryAllBooks.mockResolvedValue([]);
    
    await service.runPublisherSync(mockSendEvent, () => true);

    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'status', message: 'Przerwano Rytuał Wydania.' }));
    expect(mockNotion.updatePage).not.toHaveBeenCalled();
  });
});
