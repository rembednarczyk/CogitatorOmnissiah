import { renderHook, waitFor } from '@testing-library/react';
import { useStats } from '../useStats';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useStats', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches stats on mount', async () => {
    const mockStats = { authorStats: [] };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStats)
    });

    const { result } = renderHook(() => useStats());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toEqual(mockStats);
  });

  it('handles fetch error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false
    });

    const { result } = renderHook(() => useStats());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Błąd podczas pobierania statystyk');
  });
});
