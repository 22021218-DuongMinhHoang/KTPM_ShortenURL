// returns an object that respects the service interface
const db = require('../infrastructure/db'); // sqlite wrapper

function makeUrlService() {
  return {
    async findOrigin(id) {
      return db.findOrigin(id); // original logic
    },
    async shortUrl(url) {
      return db.shortUrl(url);
    }
  };
}

module.exports = makeUrlService;
