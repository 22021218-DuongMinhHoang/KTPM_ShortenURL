const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 100;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function wrapWithRetry(fn, {
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
} = {}) {
  return async function retryWrapper(...args) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (err) {
        lastError = err;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        if (err && err.isBadRequest) throw err;

        // exponential / linear backoff
        const delay = baseDelayMs * attempt;
        await sleep(delay);
      }
    }
  };
}

module.exports = {
  meta: {
    priority: 0,
    phase: 'both',
  },

  register: async ({ app }) => {
  },

  decorate: (service) => {
    const wrapped = { ...service };

    for (const [key, value] of Object.entries(service)) {
      if (typeof value === 'function') {
        wrapped[key] = wrapWithRetry(value);
      }
    }

    return wrapped;
  },
};
