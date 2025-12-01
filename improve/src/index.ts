import { Elysia } from "elysia";
import * as db from "./db";
import * as cache from "./cache";
import { redirectService } from "./services/redirect";
import { shortenService } from "./services/shorten";
import { rateLimitMiddleware } from "./middleware/rateLimit";

const serviceType = process.env.SERVICE_TYPE || "both";
const port = parseInt(process.env.PORT || "3001", 10);

async function main() {
  try {
    console.log("Initializing database...");
    await db.initDatabase();

    const app = new Elysia();

    app.use(rateLimitMiddleware);

    if (serviceType === "redirect") {
      console.log("Starting URL Redirect Service (CQRS Read)");
      app.use(redirectService);
    } else if (serviceType === "shorten") {
      console.log("Starting URL Shorten Service (CQRS Write)");
      app.use(shortenService);
    } else {
      console.log("Starting Combined Service (both Read and Write)");
      app.use(redirectService);
      app.use(shortenService);
    }

    app.onError(({ error, set }) => {
      console.error("Unhandled error:", error);
      set.status = 500;
      return {
        error: "internal_error",
        message: "An unexpected error occurred",
      };
    });

    app.listen({ port, hostname: "0.0.0.0" });

    console.log(`Server running on port ${port}`);
    console.log(`Service Type: ${serviceType}`);

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Closing gracefully...`);
      await db.closeDatabase();
      await cache.closeCache();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
