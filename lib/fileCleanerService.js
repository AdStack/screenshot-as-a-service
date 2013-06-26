var fs = require('fs');

var FileCleanerService = module.exports = function (lifetime) {
  // Default to 1 min (60000 millis); allow 0 for no caching
  this.lifetime = (typeof lifetime == 'undefined') ? 60000 : lifetime;
  this.files = {};
  var self = this;
  process.on('exit', function () {
    self.removeAllFiles();
  });
};

FileCleanerService.prototype.addFile = function (path) {
  // Do nothing if not undefined; the file will expire sooner than expected
  if (typeof this.files[path] != 'undefined') {
    return;
  }

  var self = this;

  this.files[path] = setTimeout(function() {
    self.removeFile(path);
  }, this.lifetime);
};

FileCleanerService.prototype.removeFile = function (path) {
  if (typeof this.files[path] == 'undefined') {
    throw new Error('File ' + path + 'is not managed by the cleaner service');
  }

  delete this.files[path];

  try {
    fs.unlinkSync(path);
  } catch(err) {
    console.error(err);
  }
};

FileCleanerService.prototype.removeAllFiles = function () {
  for (var path in this.files) {
    this.removeFile(path);
  }
};
