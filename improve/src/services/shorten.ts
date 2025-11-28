import { Elysia } from "elysia";
import * as cache from "../cache";
import * as db from "../db";
import { withRetry } from "../utils/retry";

export const shortenService = new Elysia()
  .post("/api/shorten", async ({ body, set, request }) => {
    try {
      const { url } = body as { url?: string };

      if (!url) {
        return (
          (set.status = 400),
          { error: "bad_request", message: "Missing url field" }
        );
      }

      try {
        new URL(url);
      } catch {
        return (
          (set.status = 400),
          { error: "invalid_url", message: "Invalid URL format" }
        );
      }

      const id = await db.shortUrl(url);

      const cacheKey = `url:${id}`;
      await cache.set(cacheKey, url);

      return {
        id,
        originalUrl: url,
      };
    } catch (err) {
      console.error("Shorten API error:", err);
      return (
        (set.status = 500),
        { error: "internal_error", message: "Failed to create short URL" }
      );
    }
  })
  .get("/health", () => ({ status: "healthy", service: "shorten" }));
