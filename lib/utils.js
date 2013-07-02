var crypto = require('crypto');

exports.md5 = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

exports.url = function (url) {
  if (url.indexOf('://') !== -1) {
    return url;
  } else if (url.indexOf('/') === 0) {
    return 'file://' + url;
  } else {
    return 'http://' + url;
  }
};
