var request = require('request');
var child_process = require('child_process');

var spawn = child_process.spawn;

var RasterizerService = module.exports = function (config) {
  // config should contain command, port, path, viewport
  this.config = config;

  this.isStopping = false;
  this.healthCheckInterval = 1000 * 1;
  this.pingServiceInterval = 1000 * 10;
  this.healthCheckThreshold = this.pingServiceInterval * 3;
  this.lastHealthCheckDate = null;

  var self = this;

  process.on('exit', function () {
    self.isStopping = true;
    self.killService();
  });
};

RasterizerService.prototype.startService = function () {
  this.rasterizer = spawn(
    this.config.command,
    [
      'scripts/rasterizer.js',
      this.config.path,
      this.config.port,
      this.config.viewport
    ]
  );

  this.rasterizer.stdout.on('data', function (data) {
    console.log('phantomjs output: ' + data);
  });

  this.rasterizer.stderr.on('data', function (data) {
    console.log('phantomjs error: ' + data);
  });

  var self = this;

  this.rasterizer.on('exit', function (code) {
    if (!self.isStopping) {
      console.log('phantomjs exited; starting again');
      self.startService();
    }
  });

  this.lastHealthCheckDate = Date.now();
  this.healthCheckIntervalId = setInterval(this.checkHealth.bind(this),
    this.healthCheckInterval);
  this.pingServiceIntervalId = setInterval(this.pingService.bind(this),
    this.pingServiceInterval);

  console.log('phantomjs listening on port ' + this.config.port);

  return this;
};

RasterizerService.prototype.killService = function () {
  if (this.rasterizer) {
    clearInterval(this.pingServiceIntervalId);
    clearInterval(this.healthCheckIntervalId);
    this.rasterizer.kill();
    // NOTE: 'exit' event will start the service again
  }
};

RasterizerService.prototype.restartService = function () {
  if (this.rasterizer) {
    this.killService();
    // 'exit' event will start the service again
  }
};

RasterizerService.prototype.pingService = function () {
  if (!this.rasterizer) {
    this.lastHealthCheckDate = 0;
  }

  var self = this;

  request(
    'http://localhost:' + this.getPort() + '/healthCheck',
    function (error, response) {
      if (!error && response.statusCode == 200) {
        self.lastHealthCheckDate = Date.now();
      }
    }
  );
};

RasterizerService.prototype.checkHealth = function () {
  if (Date.now() - this.lastHealthCheckDate > this.healthCheckThreshold) {
    console.log('phantomjs health check out of date; restarting');
    this.restartService();
  }
};

RasterizerService.prototype.getPort = function () {
  return this.config.port;
};

RasterizerService.prototype.getPath = function () {
  return this.config.path;
};
