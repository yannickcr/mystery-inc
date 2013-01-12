var
	http = require('http'),
	crypto = require('crypto'),
	url = require('url'),
	fs = require('fs'),
	path= require('path'),
	util= require('util'),

	request = require('request'),

	istanbul = require('istanbul'),
	instrumenter = new istanbul.Instrumenter(),
	collector = new istanbul.Collector()
;

function MysteryInc(opts) {
	this.opts = util._extend({
		proxyPort: 9090,
		reportPath: './html-report',
		cacheDir: './instrumented',
		verbose: false
	}, opts);

	this.htmlReport = istanbul.Report.create('html', {
		dir: this.opts.reportPath
	});
	this.textReport = istanbul.Report.create('text');
	this._startProxy();
}

MysteryInc.prototype.watch = function(spooky) {
	spooky.on('mysteryInc.report', function(data) {
		this.proxy.close();
		collector.add(data);
		this.htmlReport.writeReport(collector, true);
		this.textReport.writeReport(collector, true);
	}.bind(this));
};

MysteryInc.prototype._startProxy = function() {
	this.proxy = http.createServer(function (req, res) {
		var headers = req.headers;
		headers['accept-encoding'] = null; // Remove gzip support (TODO: accept gipped responses)
		var options = {
			uri: req.url,
			headers: req.headers,
			followRedirect: false,
			encoding: 'hex'
		};

		request(options, function(requestErr, requestRes, requestData) {
			// Return a 404 if the request encountered an error
			if (requestErr) {
				res.writeHead(404);
				res.end();
				return;
			}

			this._processData(req, requestRes, requestData, function(data) {

				var headers = requestRes.headers;

				// Update the content length
				headers['content-length'] = data.length;

				res.writeHead(requestRes.statusCode || 200, headers);
				res.write(data);
				res.end();
			});
		}.bind(this));

	}.bind(this)).listen(this.opts.proxyPort);
};

MysteryInc.prototype._processData = function(req, res, sourceData, cbk) {
	// Process the data
	sourceData = new Buffer(sourceData || '', 'hex').toString();
	var headers = res.headers;

	// Return directly the response if it is not a javascript file
	if (!headers['content-type'] || !headers['content-type'].match(/javascript/)) return cbk(sourceData);

	// Calculate the sha1 of the uninstrumented data
	var shasum = crypto
		.createHash('sha1')
		.update(sourceData)
		.digest('hex')
	;

	// Search if the instrumented file is already in cache
	fs.readFile(this.opts.cacheDir + path.sep + shasum + '.js', function (err, instrumentedData) {
		// Cached file found
		if (!err) {
			if (this.opts.verbose) console.info('[info] [MysteryInc] Read "' + req.url + '" from cache');
			return cbk(instrumentedData);
		}

		var
			file = url.parse(req.url),
			filepath = this.opts.cacheDir + path.sep + 'source' + path.sep + file.host.replace(':', '-'),
			filename = filepath + path.sep + file.pathname.replace(/[^a-z0-9.]/gi, '-').replace(/-+/gi, '-').replace(/^-|-$/g, '')
		;

		if (this.opts.verbose) console.info('[info] [MysteryInc] Instrumenting "' + req.url + '"');

		instrumenter.instrument(sourceData, filename, function(err, instrumentedData) {
			if (err) {
				console.error('[error] [MysteryInc] Error processing:"' + req.url + '"');
				return cbk(sourceData);
			}

			if (this.opts.verbose) console.info('[info] [MysteryInc] Instrumented to "' + filename + '"');

			var fullFilepath = '';
			filepath.split(path.sep).forEach(function(dir) {
				fullFilepath += dir + path.sep;
				if(!fs.existsSync(fullFilepath)) fs.mkdirSync(fullFilepath);
			});

			// Caching: Write the non-instrumented data in a file
			fs.writeFile(filename, sourceData);
			// Caching: Write the instrumented data in a file
			fs.writeFile(this.opts.cacheDir + path.sep + shasum + '.js', instrumentedData);

			// Send the response
			return cbk(instrumentedData);
		}.bind(this));
	}.bind(this));
};

module.exports = MysteryInc;