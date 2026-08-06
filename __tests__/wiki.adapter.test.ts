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
  });

  describe('fetchPageContentWithSlots', () => {
    it('fetches page content from main slot', async () => {
      const mockResponse = {
        data: {
          query: {
            pages: {
              '123': {
                revisions: [{
                  slots: {
                    main: { '*': 'Slot Content' }
                  }
                }]
              }
            }
          }
        }
      };
      mockGet.mockResolvedValueOnce(mockResponse);
      
      const content = await wikiAdapter.fetchPageContentWithSlots('Test Title');
      expect(content).toBe('Slot Content');
    });
  });
});
