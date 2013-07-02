var fs = require('fs');
var request = require('request');
var path = require('path');

var utils = require('../lib/utils');

module.exports = function (app, useCors) {
  var rasterizerService = app.settings.rasterizerService;
  var fileCleanerService = app.settings.fileCleanerService;

  app.get('/', function (req, res, next) {
    if (!req.param('url', false)) {
      return res.redirect('/usage.html');
    }

    var url = utils.url(req.param('url'));
    var returnUrl = req.param('returnUrl', false) ?
      utils.url(req.param('returnUrl')) : false;
    var options = {
      uri: 'http://localhost:' + rasterizerService.getPort() + '/',
      headers: {
        url: url
      }
    };

    [
      'width', 'height', 'clipRect', 'javascriptEnabled', 'loadImages', 'delay',
      'localToRemoteUrlAccessEnabled', 'userAgent', 'userName', 'password',
      'selectors', 'css'
    ].forEach(function (name) {
      if (req.param(name, false)) {
        options.headers[name] = req.param(name);
      }
    });

    options.headers.filename = 'screenshot_' + utils.md5(
      url + JSON.stringify(options)) + '.png';

    var filePath = path.join(
      rasterizerService.getPath(),
      options.headers.filename
    );

    var callback;

    if (returnUrl) {
      res.send('Will post screenshot to ' + returnUrl + ' when processed');
      callback = function (error) {
        if (error) {
          next(error);
        }
        postImageToUrl(filePath, returnUrl, next);
      };
    } else {
      callback = function (error) {
        if (error) {
          next(error);
        }
        sendImageInResponse(filePath, res, next);
      };
    }

    if (options.headers.selectors) {
      console.log('Request for %s - Rasterizing frames', url);
      callRasterizer(options, res, callback);
    } else if (fs.existsSync(filePath)) {
      console.log('Request for %s - Found in cache', url);
      callback(null);
    } else {
      console.log('Request for %s - Rasterizing it', url);
      callRasterizer(options, null, callback);
    }
  });

  var callRasterizer = function (options, res, callback) {
    request.get(options, function (error, response, body) {
      if (error || response.statusCode != 200) {
        console.log('Error while requesting the rasterizer: %s', error.message);
        rasterizerService.restartService();
        return callback(new Error(body));
      } else {
        if (res) {
          res.send(response.body);
        } else {
          callback(null);
        }
      }
    });
  };

  var postImageToUrl = function (imagePath, returnUrl, callback) {
    console.log('Streaming image to %s', returnUrl);

    var fileStream = fs.createReadStream(imagePath);

    fileStream.on('end', function () {
      fileCleanerService.addFile(imagePath);
    });

    fileStream.on('error', function (error) {
      console.log('Error while reading file: %s', error.message);
      callback(error);
    });

    fileStream.pipe(request.post(returnUrl, function (error) {
      if (error) {
        console.log('Error while streaming screenshot: %s', error);
        callback(error);
      }
    }));
  };

  var sendImageInResponse = function (imagePath, res, callback) {
    console.log('Sending image in response');

    if (useCors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
    }

    res.sendfile(imagePath, function (error) {
      if (error) {
        callback(error);
      } else {
        fileCleanerService.addFile(imagePath);
      }
    });
  };
};
