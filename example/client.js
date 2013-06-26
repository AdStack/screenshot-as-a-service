var http = require('http');
var url = require('url');
var fs = require('fs');

// Create a server to receive callbacks, and save the body as a PNG file
http.createServer(function (req, res) {
  var name = url.parse(req.url).pathname.slice(1);

  req.on('end', function () {
    res.writeHead(200);
    res.end();
  });

  req.pipe(fs.createWriteStream(__dirname + '/' + name + '.png'));
}).listen(8124);
console.log("Server running on port 8124");

var sites = {
  'google': 'http://www.google.com',
  'yahoo': 'http://www.yahoo.com'
};

var screenshotServiceUrl = 'http://localhost:3000/';
var doNothing = function (res) {};

// Call the screenshot service
setInterval(function () {
  for (var name in sites) {
    var options = url.parse(
      screenshotServiceUrl + sites[name] + '?callback=http://localhost:8124/' +
      name);

    http.get(options, doNothing);
  }
}, 60000);
