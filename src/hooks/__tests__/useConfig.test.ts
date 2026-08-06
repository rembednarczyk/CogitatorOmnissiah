import { renderHook, waitFor } from '@testing-library/react';
import { useConfig } from '../useConfig';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useConfig', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches config on mount', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ isSyncing: false }) }) // health
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ hasNotionKey: true, hasDatabaseId: true }) }); // config
    
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(JSON.stringify({ properties: {} })) }); // schema

    const { result } = renderHook(() => useConfig());

    await waitFor(() => expect(result.current.configStatus.loading).toBe(false));
    expect(result.current.configStatus.hasNotionKey).toBe(true);
    
    await waitFor(() => expect(result.current.schema).not.toBe(null));
    expect(result.current.schema.properties).toBeDefined();
  });
});
