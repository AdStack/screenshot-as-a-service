var webpage = require('webpage');

var basePath = phantom.args[0] || '/tmp/';
var port = phantom.args[1] || 3001;

var defaultViewportSize = (phantom.args[2] || '').split('x');
defaultViewportSize = {
  width: defaultViewportSize[0] || 1024,
  height: defaultViewportSize[1] || 600
};

var pageSettings = [
  'javascriptEnabled', 'loadImages', 'localToRemoteUrlAccessEnabled',
  'userAgent', 'userName', 'password'
];

var server = require('webserver').create();

var service = server.listen(port, function (request, response) {
  if (request.url == '/healthCheck') {
    response.statusCode = 200;
    response.write('up');
    response.close();
    return;
  } else if (!request.headers.url) {
    response.statusCode = 400;
    response.write('Error: Request must contain an url header' + '\n');
    response.close();
    return;
  }

  var page = webpage.create();
  var url = request.headers.url;
  var delay = request.headers.delay || 0;
  var path = basePath + (request.headers.filename ||
    (url.replace(new RegExp('https?://'), '').replace(/\//g, '.') + '.png'));

  try {
    page.viewportSize = {
      width: request.headers.width || defaultViewportSize.width,
      height: request.headers.height || defaultViewportSize.height
    };

    if (request.headers.clipRect) {
      page.clipRect = JSON.parse(request.headers.clipRect);
    }

    for (var name in pageSettings) {
      value = request.headers[pageSettings[name]];

      if (value) {
        console.log(value);
        value = (value == 'false') ? false : ((value == 'true') ? true : value);
        page.settings[pageSettings[name]] = value;
      }
    }
  } catch (err) {
    response.statusCode = 500;
    response.write('Error while parsing headers: ' + err.message);
    response.close();
    return;
  }

  page.open(url, function (status) {
    var getClipRect = function (page, selector) {
      return page.evaluate(function (selector) {
        var element = document.querySelector(selector);
        return element === null ? '' : element.getBoundingClientRect();
      }, selector);
    };

    if (status == 'success') {
      window.setTimeout(function () {
        var responseBody = '';

        if (request.headers.selectorBase) {
          for (var i = request.headers.selectorStart;
              i < request.headers.selectorEnd; ++i) {
            var clipRect = getClipRect(page, request.headers.selectorBase + i);

            // Do not reassign object directly; extra values might be given
            page.clipRect = {
              left: clipRect.left,
              top: clipRect.top,
              width: clipRect.width,
              height: clipRect.height
            };

            // Delimit the base 64 encoded images by newlines
            responseBody += page.renderBase64('PNG') + '\n';
          }
        } else {
          page.render(path);
          responseBody = 'Success: Screenshot saved to ' + path + '\n';
        }

        response.write(responseBody);
        response.close();
        page.close();
      }, delay);
    } else {
      response.write('Error: Url returned status ' + status + '\n');
      response.close();
      page.close();
    }
  });

  // Must begin the response now to keep the connection open
  response.statusCode = 200;
  response.write('');
});
