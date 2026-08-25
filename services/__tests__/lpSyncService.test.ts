import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LpSyncService } from '../lpSyncService';
import { NotionAdapter } from '../../notion.adapter';
import { NotionBook } from '../../src/types';

describe('LpSyncService', () => {
  let service: LpSyncService;
  let mockNotion: any;
  let mockSendEvent: any;

  beforeEach(() => {
    mockNotion = {
      queryAllBooks: vi.fn(),
      updateLp: vi.fn(),
    };

    mockSendEvent = vi.fn();

    service = new LpSyncService(mockNotion as unknown as NotionAdapter);
  });

  it('sorts books by year and title and updates Lp', async () => {
    const mockBooks: NotionBook[] = [
      {
        id: 'page-2',
        plTitle: 'B',
        author: 'Author',
        origTitle: 'B',
        year: '2000',
        lp: '1',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        plTitleRichText: [],
        origTitleRichText: []
      },
      {
        id: 'page-1',
        plTitle: 'A',
        author: 'Author',
        origTitle: 'A',
        year: '1990',
        lp: '2',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        plTitleRichText: [],
        origTitleRichText: []
      }
    ];

    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);

    await service.runLpSync(mockSendEvent, () => false);

    // After sort: page-1 (1990) should be Lp 1, page-2 (2000) should be Lp 2
    expect(mockNotion.updateLp).toHaveBeenCalledWith('page-1', '1');
    expect(mockNotion.updateLp).toHaveBeenCalledWith('page-2', '2');
    expect(mockSendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'complete' }));
  });

  it('does not number cycle-volume rows (Kategoria=Tom cyklu)', async () => {
    const base = { author: 'A', origTitle: '', awards: [], zrodlo: [], currentWydawnictwo: '', currentSeria: '', currentCzesccyklu: false, plTitleRichText: [], origTitleRichText: [] };
    mockNotion.queryAllBooks.mockResolvedValue([
      { ...base, id: 'award', plTitle: 'Nagrodzona', year: '1990', lp: 'x' },
      { ...base, id: 'vol', plTitle: 'Tom cyklu', year: '1991', lp: 'y', kategoria: 'Tom cyklu' },
    ] as NotionBook[]);

    await service.runLpSync(mockSendEvent, () => false);

    // Tylko pozycja nagrodowa dostaje numer; tom cyklu pominięty w numeracji.
    expect(mockNotion.updateLp).toHaveBeenCalledWith('award', '1');
    expect(mockNotion.updateLp).not.toHaveBeenCalledWith('vol', expect.anything());
  });
});
