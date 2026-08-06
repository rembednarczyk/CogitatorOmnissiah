import { renderHook, act, waitFor } from '@testing-library/react';
import { useSync } from '../useSync';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useSync', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('initializes with correct state', () => {
    const { result } = renderHook(() => useSync('/api/sync', '/api/stop'));
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.result).toBe(null);
    expect(result.current.state.error).toBe(null);
  });

  it('starts sync and handles SSE events', async () => {
    const encoder = new TextEncoder();
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ value: encoder.encode('data: {"type": "status", "message": "Test Status"}\n\n'), done: false })
        .mockResolvedValueOnce({ value: encoder.encode('data: {"type": "complete", "result": {"success": true}}\n\n'), done: false })
        .mockResolvedValueOnce({ value: undefined, done: true })
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader
      }
    });

    const { result } = renderHook(() => useSync('/api/sync', '/api/stop'));

    await act(async () => {
      result.current.startSync();
    });

    await waitFor(() => expect(result.current.state.loading).toBe(false), { timeout: 2000 });
    expect(result.current.state.result).toEqual({ success: true });
    expect(result.current.state.statusMessage).toBe(null);
  });

  it('handles errors during sync', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server Error' })
    });

    const { result } = renderHook(() => useSync('/api/sync', '/api/stop'));

    await act(async () => {
      result.current.startSync();
    });

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.error).toBe('Server Error');
  });
});
