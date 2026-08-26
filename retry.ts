export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
  backoffFactor = 2,
  idempotent = true
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

      // 429 (rate limit) means the request was REJECTED before processing
      // — retrying is always safe, even for non-idempotent operations.
      const isRateLimit = error?.status === 429 || error?.response?.status === 429;

      // 5xx and network errors (socket hang up etc.) may leave a request PARTIALLY
      // processed: for non-idempotent operations (e.g. pages.create) a retry
      // creates a duplicate. Retry them only when the caller declares idempotent=true.
      const isServerError = idempotent && (error?.status >= 500 || error?.response?.status >= 500);

      const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ERR_HTTP2_GOAWAY_SESSION', 'ERR_STREAM_WRITE_AFTER_END'];
      const isTransientNetworkError = idempotent && (transientCodes.includes(error?.code) ||
                                     (error?.message && (
                                       error.message.toLowerCase().includes('socket hang up') ||
                                       error.message.toLowerCase().includes('connreset') ||
                                       error.message.toLowerCase().includes('timeout')
                                     )));

      if (!isRateLimit && !isServerError && !isTransientNetworkError) {
        // Don't retry client errors (4xx other than 429) nor — for non-idempotent
        // operations — 5xx/network errors that may have already written data.
        throw error;
      }

      let waitTime = delayMs * Math.pow(backoffFactor, attempt - 1);

      // Notion (and other APIs) send Retry-After on 429 — respect it instead of guessing
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
