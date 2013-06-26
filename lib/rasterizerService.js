var request = require('request');
var child_process = require('child_process');

var spawn = child_process.spawn;

var RasterizerService = module.exports = function (config) {
  // config should contain command, port, path, viewport
  this.config = config;
  this.isStopping = false;
  this.sleepTime = 30000;
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

  this.rasterizer.stderr.on('data', function (data) {
    console.log('phantomjs error: ' + data);
  });

  this.rasterizer.stdout.on('data', function (data) {
    console.log('phantomjs output: ' + data);
  });

  var self = this;

  this.rasterizer.on('exit', function (code) {
    if (self.isStopping) {
      return;
    }

    console.log('phantomjs failed; restarting');
    self.startService();
  });

  this.lastHealthCheckDate = Date.now();
  this.pingServiceIntervalId = setInterval(this.pingService.bind(this), 10000);
  this.checkHealthIntervalId = setInterval(this.checkHealth.bind(this), 1000);

  console.log(
    'Phantomjs internal server listening on port ' + this.config.port);

  return this;
};

RasterizerService.prototype.killService = function () {
  if (this.rasterizer) {
    this.rasterizer.kill();
    clearInterval(this.pingServiceIntervalId);
    clearInterval(this.checkHealthIntervalId);
    console.log('Stopping Phantomjs internal server');
  }
};

RasterizerService.prototype.restartService = function () {
  if (this.rasterizer) {
    this.killService();
    this.startService();
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
      if (error || response.statusCode != 200) {
        return;
      }

      self.lastHealthCheckDate = Date.now();
    }
  );
};

RasterizerService.prototype.checkHealth = function () {
  if (Date.now() - this.lastHealthCheckDate > this.sleepTime) {
    console.log('Phantomjs process is sleeping. Restarting.');
    this.restartService();
  }
};

RasterizerService.prototype.getPort = function () {
  return this.config.port;
};

RasterizerService.prototype.getPath = function () {
  return this.config.path;
};
