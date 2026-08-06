import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry } from '../retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('resolves immediately if function succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 rate limit error', async () => {
    const error429 = new Error('Rate limit');
    (error429 as any).status = 429;
    
    const fn = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce('success');

    const promise = withRetry(fn, 3, 100);
    
    // Fast-forward timers to skip the delay
    await vi.runAllTimersAsync();
    
    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx server error', async () => {
    const error500 = new Error('Server error');
    (error500 as any).status = 500;
    
    const fn = vi.fn()
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce('success');

    const promise = withRetry(fn, 3, 100);
    await vi.runAllTimersAsync();
    
    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx client errors (except 429)', async () => {
    const error404 = new Error('Not found');
    (error404 as any).status = 404;
    
    const fn = vi.fn().mockRejectedValue(error404);

    await expect(withRetry(fn, 3, 100)).rejects.toThrow('Not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries', async () => {
    const error500 = new Error('Server error');
    (error500 as any).status = 500;
    
    const fn = vi.fn().mockRejectedValue(error500);

    const promise = withRetry(fn, 3, 100);
    
    // Attach a catch handler to prevent unhandled rejection warning
    promise.catch(() => {});
    
    // Advance timers enough times to trigger all retries
    for (let i = 0; i < 3; i++) {
      await vi.runAllTimersAsync();
    }

    await expect(promise).rejects.toThrow('Server error');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
