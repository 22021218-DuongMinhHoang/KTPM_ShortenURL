const fs = require('fs');
const path = require('path');

function loadPlugins({ app, service }) {
  const pluginsDir = path.join(__dirname, '..', 'plugins');
  if (!fs.existsSync(pluginsDir)) return { app, service };

  const pluginNames = fs.readdirSync(pluginsDir);
  for (const p of pluginNames) {
    const plPath = path.join(pluginsDir, p);
    const mod = require(plPath);
    // each plugin can export register({app}) and/or decorate(service)
    if (typeof mod.register === 'function') {
      mod.register({ app });
    }
    if (typeof mod.decorate === 'function') {
      service = mod.decorate(service);
    }
  }
  return { app, service };
}

module.exports = loadPlugins;
