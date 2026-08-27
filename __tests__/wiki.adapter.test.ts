import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn()
}));

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        get: mockGet
      }))
    }
  };
});

import { WikiAdapter } from '../wiki.adapter';

describe('WikiAdapter', () => {
  let wikiAdapter: WikiAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    wikiAdapter = new WikiAdapter();
  });

  describe('fetchPageContent', () => {
    it('fetches page content successfully', async () => {
      const mockResponse = {
        data: {
          query: {
            pages: {
              '123': {
                revisions: [{ '*': 'Mocked Wiki Content' }]
              }
            }
          }
        }
      };
      mockGet.mockResolvedValueOnce(mockResponse);
      
      const content = await wikiAdapter.fetchPageContent('Test Title');
      expect(content).toBe('Mocked Wiki Content');
      expect(mockGet).toHaveBeenCalledWith(
        'https://encyklopediafantastyki.pl/api.php',
        expect.objectContaining({
          params: expect.objectContaining({
            titles: 'Test Title'
          })
        })
      );
    });

    it('returns empty string when page is not found', async () => {
      const mockResponse = {
        data: {
          query: {
            pages: {
              '-1': { missing: true }
            }
          }
        }
      };
      mockGet.mockResolvedValueOnce(mockResponse);

      await expect(wikiAdapter.fetchPageContent('Unknown Title')).resolves.toBe('');
    });

    it('throws on infrastructure failure instead of masking it as missing page', async () => {
      mockGet.mockRejectedValue(Object.assign(new Error('Request failed with status code 403'), { response: { status: 403 } }));

      await expect(wikiAdapter.fetchPageContent('Any Title')).rejects.toThrow('Nie udało się pobrać strony');
    });
  });

  describe('fetchPagesContentBulk', () => {
    it('returns contents and follows the MediaWiki continue token', async () => {
      mockGet
        .mockResolvedValueOnce({
          data: {
            query: { pages: { '1': { title: 'Solaris', revisions: [{ '*': 'Content A' }] } } },
            continue: { rvcontinue: 'token', continue: '||' }
          }
        })
        .mockResolvedValueOnce({
          data: {
            query: { pages: { '2': { title: 'Diuna', revisions: [{ '*': 'Content B' }] } } }
          }
        });

      const { contents, failedTitles } = await wikiAdapter.fetchPagesContentBulk(['Solaris', 'Diuna']);
      expect(contents['solaris']).toBe('Content A');
      expect(contents['diuna']).toBe('Content B');
      expect(failedTitles).toEqual([]);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('reports failed titles instead of silently dropping them', async () => {
      mockGet.mockRejectedValue(Object.assign(new Error('Request failed with status code 403'), { response: { status: 403 } }));

      const { contents, failedTitles } = await wikiAdapter.fetchPagesContentBulk(['Solaris', 'Diuna']);
      expect(contents).toEqual({});
      expect(failedTitles).toEqual(['Solaris', 'Diuna']);
    });
  });
});
