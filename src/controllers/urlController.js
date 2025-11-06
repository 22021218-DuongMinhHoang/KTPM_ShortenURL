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

  app.post('/create', async (req, res) => {
    try {
      const url = req.query.url;
      const newID = await service.shortUrl(url);
      res.send(newID);
    } catch (err) {
      res.status(500).send(err.message || err);
    }
  });
}

module.exports = { createUrlController };
