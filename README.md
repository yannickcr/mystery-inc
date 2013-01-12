# MysteryInc

Istanbul code coverage reporter for CasperJS.

## Installation

### Prerequisites

* [Node.js](http://nodejs.org)
* [PhantomJS](http://phantomjs.org/)
* [CasperJS](http://casperjs.org/)
* [SpookyJS](https://github.com/WaterfallEngineering/SpookyJS) (will be automatically installed as peer dependency with Node.js >= 0.8.17)

``` shell
git clone https://github.com/yannickcr/MysteryInc.git ./node_modules/mystery-inc
cd ./node_modules/mystery-inc/
npm install
```

## Usage

``` javascript
var Spooky = require('spooky');
var MysteryInc = require('mystery-inc');

// Create the mysteryInc instance
var mysteryInc = new MysteryInc();

var spooky = new Spooky({
	child: {
		command: 'casperjs',
		port: 8081,
		script: './node_modules/spooky/lib/bootstrap.js',
		spooky_lib: './node_modules/spooky/node_modules',
		proxy: 'localhost:9090' // Set the proxy to the MysteryInc one (default to 'localhost:9090')
	}
}, function (err) {
	if (err) {
		e = new Error('Failed to initialize SpookyJS');
		e.details = err;
		throw e;
	}

	spooky.on('error', function (e) {
		console.error(e);
	});

	spooky.on('console', function (line) {
		console.log(line);
	});

	// Bind MysteryInc to the spooky instance
	mysteryInc.watch(spooky);

	// Start
	spooky.start('http://casperjs.org');

	spooky.then(function() {
		// Do stuff
	});

	spooky.run(function() {
		// Retrieve the data and send it to MysteryInc
		this.emit('mysteryInc.report', this.evaluate(function() { return __coverage__; }));

		this.exit();
	});

});
```
## TODO

* Documentation
* Improve the proxy
* Possiblity to ignore some files
* Keep data with multiple page navigation

## License

MysteryInc is made available under the [MIT License](http://opensource.org/licenses/mit-license.php).