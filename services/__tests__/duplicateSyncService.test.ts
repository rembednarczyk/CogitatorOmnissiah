import { fakeConfig } from "./testConfig";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuplicateSyncService } from '../duplicateSyncService';
import { NotionAdapter } from '../../notion.adapter';
import { WikiAdapter } from '../../wiki.adapter';
import { NotionBook } from '../../src/types';

describe('DuplicateSyncService', () => {
  let service: DuplicateSyncService;
  let mockNotion: any;
  let mockWiki: any;
  let mockSendEvent: any;

  beforeEach(() => {
    mockNotion = {
      init: vi.fn(),
      queryAllBooks: vi.fn(),
    };

    mockWiki = {};

    mockSendEvent = vi.fn();

    service = new DuplicateSyncService(mockNotion as unknown as NotionAdapter, mockWiki as unknown as WikiAdapter, fakeConfig);
  });

  it('detects duplicates with identical titles', async () => {
    const mockBooks: NotionBook[] = [
      {
        id: '1',
        plTitle: 'Solaris',
        author: 'Stanisław Lem',
        origTitle: 'Solaris',
        year: '1961',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      },
      {
        id: '2',
        plTitle: 'Solaris',
        author: 'Stanisław Lem',
        origTitle: 'Solaris',
        year: '1961',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '2',
        plTitleRichText: [],
        origTitleRichText: []
      }
    ];

    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);

    await service.runDuplicateCheck(mockSendEvent, () => false);

    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'complete',
      result: expect.objectContaining({
        duplicates: expect.arrayContaining([
          expect.objectContaining({ reason: 'identyczny tytuł PL' })
        ])
      })
    }));
  });

  it('detects duplicates with common words and same author', async () => {
    const mockBooks: NotionBook[] = [
      {
        id: '1',
        plTitle: 'The Left Hand of Darkness',
        author: 'Ursula K. Le Guin',
        origTitle: 'The Left Hand of Darkness',
        year: '1969',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      },
      {
        id: '2',
        plTitle: 'Lewa ręka ciemności',
        author: 'Ursula K. Le Guin',
        origTitle: 'Left Hand of Darkness',
        year: '1969',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '2',
        plTitleRichText: [],
        origTitleRichText: []
      }
    ];

    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);

    await service.runDuplicateCheck(mockSendEvent, () => false);

    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'complete',
      result: expect.objectContaining({
        duplicates: expect.arrayContaining([
          expect.objectContaining({ reason: 'dopasowanie słów + ten sam autor' })
        ])
      })
    }));
  });
});
