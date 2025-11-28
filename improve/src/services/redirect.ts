import { Elysia } from "elysia";
import * as db from "../db";
import * as cache from "../cache";
import { withRetry } from "../utils/retry";

const cacheTTL = parseInt(process.env.CACHE_TTL || "300", 10);

const handleRedirect = async (id: string, set: any) => {
  try {
    const cacheKey = `url:${id}`;
    let url = await cache.get(cacheKey);

    if (url) {
    } else {
      url = await withRetry(() => db.findOrigin(id));

      if (!url) {
        return (set.status = 404), "<h1>404 Not Found</h1>";
      }

      cache.set(cacheKey, url, cacheTTL);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
      },
    });
  } catch (err) {
    console.error("Redirect error:", err);
    return (set.status = 500), "Internal Server Error";
  }
};

export const redirectService = new Elysia()
  .get("/short/:id", ({ params: { id }, set }) => handleRedirect(id, set))
  .get("/health", () => ({ status: "healthy", service: "redirect" }));
