const express = require('express');
const path = require('path');
const loadPlugins = require('./infrastructure/pluginLoader');
const makeUrlService = require('./services/urlService');
const { createUrlController } = require('./controllers/urlController');

const app = express();

// serve static files from src/public
app.use(express.static(path.join(__dirname, 'public')));

// optional: parse JSON body (nếu muốn dùng body JSON later)
app.use(express.json());

// rest of your code...

const port = 3000;

// 1) create base service
let urlService = makeUrlService();

// 2) load plugins -> họ có thể decorate service or register middleware
// pluginLoader trả về {app, service} sau khi mỗi plugin xử lý
const context = { app, service: urlService };
const finalContext = loadPlugins(context); 
// finalContext.service là service đã được decorate bởi các plugin

// 3) create controllers with final service
createUrlController(app, finalContext.service);

app.listen(port, () => console.log(`listening ${port}`));
