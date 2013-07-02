var webpage = require('webpage');
var webserver = require('webserver');

var server = webserver.create();
var basePath = phantom.args[0] || '/tmp/';
var port = phantom.args[1] || 3001;
var pageSettings = [
  'javascriptEnabled', 'loadImages', 'localToRemoteUrlAccessEnabled',
  'userAgent', 'userName', 'password'
];
var defaultViewportSize = (phantom.args[2] || '').split('x');
defaultViewportSize = {
  width: defaultViewportSize[0] || 1024,
  height: defaultViewportSize[1] || 600
};

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

  var getClipRect = function (selector) {
    var element = document.querySelector(selector);
    return element === null ? '' : element.getBoundingClientRect();
  };

  var injectCss = function (css) {
    // Create the element to be inserted
    var styleElement = document.createElement('style');
    styleElement.appendChild(document.createTextNode(css));

    // Determine the last stylesheet link or style tag
    var elements = document.querySelectorAll('link[rel="stylesheet"],style');
    var last = elements[elements.length - 1];

    // Insert the new style element after the last one
    last.parentNode.insertBefore(styleElement, last.nextSibling);
  };

  page.open(url, function (status) {
    if (status == 'success') {
      window.setTimeout(function () {
        var responseBody = '';

        // Apply any given css prior to rendering
        if (request.headers.css) {
          page.evaluate(injectCss, request.headers.css);
        }

        if (request.headers.selectors) {
          JSON.parse(request.headers.selectors).forEach(function (selector) {
            var clipRect = page.evaluate(getClipRect, selector);

            // Do not reassign object directly; extra values might be given
            page.clipRect = {
              left: clipRect.left,
              top: clipRect.top,
              width: clipRect.width,
              height: clipRect.height
            };

            // Delimit the base 64 encoded images by newlines
            responseBody += page.renderBase64('PNG') + '\n';
          });
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
