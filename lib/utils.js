var crypto = require('crypto');

exports.md5 = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

exports.url = function (url) {
  return (url.indexOf('://') !== -1) ? url : 'http://' + url;
};
