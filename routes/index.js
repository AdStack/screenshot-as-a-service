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
    var options = {
      uri: 'http://localhost:' + rasterizerService.getPort() + '/',
      headers: { url: url }
    };

    [
      'width', 'height', 'clipRect', 'javascriptEnabled', 'loadImages', 'delay',
      'localToRemoteUrlAccessEnabled', 'userAgent', 'userName', 'password',
      'selectorBase', 'selectorStart', 'selectorEnd'
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

    var callbackUrl = req.param('callback', false) ?
      utils.url(req.param('callback')) : false;

    if (options.headers.selectorBase) {
      console.log('Request for %s - Rasterizing %s frames', url,
        options.headers.selectorBase);

      processFramesUsingRasterizer(options, res, callbackUrl,
        function (err) {
          if (err) {
            next(err);
          }
        }
      );
    } else if (fs.existsSync(filePath)) {
      console.log('Request for %s - Found in cache', url);

      processImageUsingCache(filePath, res, callbackUrl, function (err) {
        if (err) {
          next(err);
        }
      });
    } else {
      console.log('Request for %s - Rasterizing it', url);

      processImageUsingRasterizer(options, filePath, res, callbackUrl,
        function (err) {
          if (err) {
            next(err);
          }
        }
      );
    }
  });

  // Try redirecting to the main route
  app.get('*', function (req, res, next) {
    res.redirect('/?url=' + req.url.substring(1));
  });

  var processImageUsingCache = function (filePath, res, url, callback) {
    // Asynchronous if url is given
    if (url) {
      res.send('Will post screenshot to ' + url + ' when processed');
      postImageToUrl(filePath, url, callback);
    } else {
      sendImageInResponse(filePath, res, callback);
    }
  };

  var processImageUsingRasterizer = function (rasterizerOptions, filePath, res,
      url, callback) {
    // Asynchronous if url is given
    if (url) {
      res.send('Will post screenshot to ' + url + ' when processed');

      callRasterizer(rasterizerOptions, function (error) {
        if (error) {
          return callback(error);
        }

        postImageToUrl(filePath, url, callback);
      });
    } else {
      callRasterizer(rasterizerOptions, function (error) {
        if (error) {
          return callback(error);
        }

        sendImageInResponse(filePath, res, callback);
      });
    }
  };

  var processFramesUsingRasterizer = function (rasterizerOptions, res, url,
      callback) {
    request.get(rasterizerOptions, function (error, response, body) {
      if (error || response.statusCode != 200) {
        console.log('Error while requesting the rasterizer: %s', error.message);
        rasterizerService.restartService();
        return callback(new Error(body));
      } else {
        // Respond with the newline-delimited, base 64 encoded images
        res.send(response.body);
        callback(null);
      }
    });
  };

  var callRasterizer = function (rasterizerOptions, callback) {
    request.get(rasterizerOptions, function (error, response, body) {
      if (error || response.statusCode != 200) {
        console.log('Error while requesting the rasterizer: %s', error.message);
        rasterizerService.restartService();
        return callback(new Error(body));
      }

      callback(null);
    });
  };

  var postImageToUrl = function (imagePath, url, callback) {
    console.log('Streaming image to %s', url);

    var fileStream = fs.createReadStream(imagePath);

    fileStream.on('end', function () {
      fileCleanerService.addFile(imagePath);
    });

    fileStream.on('error', function (err) {
      console.log('Error while reading file: %s', err.message);
      callback(err);
    });

    fileStream.pipe(request.post(url, function (err) {
      if (err) {
        console.log('Error while streaming screenshot: %s', err);
      }

      callback(err);
    }));
  };

  var sendImageInResponse = function (imagePath, res, callback) {
    console.log('Sending image in response');

    if (useCors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
    }

    res.sendfile(imagePath, function (err) {
      fileCleanerService.addFile(imagePath);
      callback(err);
    });
  };
};
