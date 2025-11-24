// server.js
const express = require('express');
const path = require('path');

const makeUrlService = require('./services/urlService');
const makeRateLimit = require('./services/rateLimit');
const { createUrlController } = require('./controllers/urlController'); // lưu ý đường dẫn của bạn: controller/urlController.js

const app = express();

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', true);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

<<<<<<< Updated upstream
// optional: parse JSON body (nếu muốn dùng body JSON later)
app.use(express.json());
=======
// create plain services
const urlService = makeUrlService();
>>>>>>> Stashed changes

// rate limit middleware instance
const rateLimitMiddleware = makeRateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 20),
});

// attach rateLimit only to /create (POST) route by mounting before controller routes
app.use('/create', rateLimitMiddleware);

// create controller (controller uses service.shortUrl for POST /create, and direct db for GET /short/:id if you keep it)
createUrlController(app, urlService);

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const server = app.listen(port, () => console.log(`listening ${port}`));

// Graceful shutdown (simple)
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down');
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});

module.exports = app;
