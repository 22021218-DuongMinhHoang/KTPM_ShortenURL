import { Elysia } from "elysia";
import * as cache from "../cache";
import * as db from "../db";

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
  .get("/api/links", async ({ query, set }) => {
    try {
      const page = query.page ? parseInt(query.page as string) : 1;
      const limit = query.limit ? parseInt(query.limit as string) : 20;

      const result = await db.getAllLinks(page, limit);
      return result;
    } catch (err) {
      console.error("Get links error:", err);
      return (set.status = 500), { error: "internal_error" };
    }
  })

  .get("/api/stats/:id", async ({ params: { id }, set }) => {
    try {
      const stats = await db.getUrlStats(id);
      return stats;
    } catch (err) {
      console.error("Get stats error:", err);
      return (set.status = 500), { error: "internal_error" };
    }
  })
  .get("/health", () => ({ status: "healthy", service: "shorten" }));
