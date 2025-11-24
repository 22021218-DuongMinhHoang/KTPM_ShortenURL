// services/retry.js
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * withRetry(fnFactoryOrFn, options)
 * - nếu fnFactoryOrFn là function bình thường -> gọi trực tiếp fn()
 * - options: { retries, baseDelayMs }
 * - trả về kết quả của fn hoặc ném lỗi cuối cùng
 */
module.exports = async function withRetry(fn, options = {}) {
  const retries = Number(options.retries ?? process.env.RETRY_ATTEMPTS ?? 3);
  const baseDelayMs = Number(options.baseDelayMs ?? process.env.RETRY_BASE_DELAY_MS ?? 100);

  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // fn can be async
      return await fn();
    } catch (err) {
      lastErr = err;
      // immediately rethrow for known client errors (optional flag)
      if (err && err.isBadRequest) throw err;
      if (attempt < retries) {
        const delay = baseDelayMs * attempt;
        await sleep(delay);
      }
    }
  }
  throw lastErr;
};
