import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurificationService } from '../purificationService';
import { NotionAdapter } from '../../notion.adapter';
import { NotionBook } from '../../src/types';

describe('PurificationService', () => {
  let service: PurificationService;
  let mockNotion: any;
  let mockSendEvent: any;

  beforeEach(() => {
    mockNotion = {
      init: vi.fn(),
      queryAllBooks: vi.fn(),
      updatePage: vi.fn(),
    };

    mockSendEvent = vi.fn();

    service = new PurificationService(mockNotion as unknown as NotionAdapter);
  });

  it('removes wiki formatting from titles', async () => {
    const mockBooks: NotionBook[] = [
      {
        id: 'page-1',
        plTitle: "[[Solaris]]",
        origTitle: "''Solaris''",
        author: 'Stanisław Lem',
        year: '1961',
        awards: [],
        zrodlo: [],
        currentWydawnictwo: '',
        currentSeria: '',
        currentCzesccyklu: false,
        lp: '1',
        plTitleRichText: [],
        origTitleRichText: []
      }
    ];

    mockNotion.queryAllBooks.mockResolvedValue(mockBooks);

    await service.runPurification(mockSendEvent, () => false);

    expect(mockNotion.updatePage).toHaveBeenCalledWith('page-1', {
      'Tytuł polski': expect.objectContaining({ rich_text: [expect.objectContaining({ text: { content: 'Solaris' } })] }),
      'Tytuł oryginalny': expect.objectContaining({ rich_text: [expect.objectContaining({ text: { content: 'Solaris' } })] })
    });
  });
});
