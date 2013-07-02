var config = require('config');
var express = require('express');

var FileCleanerService = require('./lib/fileCleanerService');
var RasterizerService = require('./lib/rasterizerService');

var app = express();

process.on('uncaughtException', function (err) {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('SIGTERM', function () {
  process.exit(0);
});

process.on('SIGINT', function () {
  process.exit(0);
});

app.configure(function () {
  app.use(express.bodyParser());
  app.use(app.router);
  app.set('fileCleanerService', new FileCleanerService(config.cache.lifetime));
  app.set('rasterizerService',
    new RasterizerService(config.rasterizer).startService());
});

app.configure('development', function () {
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
});

require('./routes')(app, config.server.useCors);
app.listen(config.server.port);
console.log('Express server listening on port ' + config.server.port);
