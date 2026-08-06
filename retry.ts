export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
  backoffFactor = 2
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= retries) {
        throw error;
      }

      // Check if it's a rate limit error (429) or server error (5xx)
      const isRateLimit = error?.status === 429 || error?.response?.status === 429;
      const isServerError = error?.status >= 500 || error?.response?.status >= 500;

      const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ERR_HTTP2_GOAWAY_SESSION', 'ERR_STREAM_WRITE_AFTER_END'];
      const isTransientNetworkError = transientCodes.includes(error?.code) ||
                                     (error?.message && (
                                       error.message.toLowerCase().includes('socket hang up') ||
                                       error.message.toLowerCase().includes('connreset') ||
                                       error.message.toLowerCase().includes('timeout')
                                     ));

      if (!isRateLimit && !isServerError && !isTransientNetworkError) {
        // Don't retry client errors (4xx) other than 429
        throw error;
      }

      let waitTime = delayMs * Math.pow(backoffFactor, attempt - 1);

      // Notion (i inne API) przy 429 podaje Retry-After — uszanuj go zamiast zgadywać
      if (isRateLimit) {
        const retryAfter = error?.headers?.['retry-after'] ?? error?.response?.headers?.['retry-after'];
        const retryAfterSec = parseFloat(retryAfter);
        if (!isNaN(retryAfterSec) && retryAfterSec > 0) {
          waitTime = Math.min(retryAfterSec * 1000, 60000);
        }
      }

      console.warn(`[Retry] Attempt ${attempt} failed. Retrying in ${waitTime}ms... (${error?.message})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Unreachable");
}
