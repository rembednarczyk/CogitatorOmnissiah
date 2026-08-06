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

      // 429 (rate limit) oznacza, że żądanie zostało ODRZUCONE przed przetworzeniem
      // — ponowienie jest zawsze bezpieczne, nawet dla operacji nieidempotentnych.
      const isRateLimit = error?.status === 429 || error?.response?.status === 429;

      // 5xx i błędy sieci (socket hang up itd.) mogą zostawić żądanie CZĘŚCIOWO
      // przetworzone: dla operacji nieidempotentnych (np. pages.create) ponowienie
      // tworzy duplikat. Ponawiaj je tylko, gdy wołający deklaruje idempotent=true.
      const isServerError = idempotent && (error?.status >= 500 || error?.response?.status >= 500);

      const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ERR_HTTP2_GOAWAY_SESSION', 'ERR_STREAM_WRITE_AFTER_END'];
      const isTransientNetworkError = idempotent && (transientCodes.includes(error?.code) ||
                                     (error?.message && (
                                       error.message.toLowerCase().includes('socket hang up') ||
                                       error.message.toLowerCase().includes('connreset') ||
                                       error.message.toLowerCase().includes('timeout')
                                     )));

      if (!isRateLimit && !isServerError && !isTransientNetworkError) {
        // Nie ponawiaj błędów klienta (4xx poza 429) ani — dla operacji
        // nieidempotentnych — błędów 5xx/sieci, które mogły już zapisać dane.
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
