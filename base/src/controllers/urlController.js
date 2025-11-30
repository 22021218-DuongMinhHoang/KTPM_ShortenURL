const lib = require('../infrastructure/db');

function createUrlController(app, service) {
  app.get('/short/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const url = await lib.findOrigin(id);
        if (!url) {
        res.status(404).send("<h1>404 Not Found</h1>");
        } else {
        // chuyển hướng đến URL gốc
        res.redirect(url);
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
    });

  app.post('/api/shorten', async (req, res) => {
    try {
      const url = req.body.url;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      const newID = await service.shortUrl(url);
      res.json({ id: newID });
    } catch (err) {
      res.status(500).json({ error: err.message || err });
    }
  });
}

module.exports = { createUrlController };
