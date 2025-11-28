
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 100;

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs || DEFAULT_BASE_DELAY_MS;

  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = baseDelayMs * attempt;
      console.warn(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}
