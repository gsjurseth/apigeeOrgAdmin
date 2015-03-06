var parser = require('argv-parser'),
	read	   = require('read'),
	async		 = require('async'),
	util		 = require('util'),
	main     = require('./main');

var rules = {
	organization: {
		type: String,
		required: true,
		short: 'o'
 	},
	list: {
		type: String,
		required: true,
		short: 'l'
 	},
	command: {
		type: String,
		required: true,
		short: 'c'
 	},
	password: {
		type: String,
		required: true,
		short: 's'
 	},
 	username: {
		type: String,
		required: true,
		short: 'u',
 	},
 	baseurl: {
		type: String,
		required: true,
		short: 'b',
 	},
 	directory: {
		type: String,
		required: false,
		short: 'd',
		default: '.'
 	},
 	debug: {
		type: Boolean,
		required: false,
		short: 'D',
 	},
};
var data = parser.parse( process.argv, { rules: rules } );

data.parsed.orgUrl = data.parsed.baseurl + "/v1/o/" + data.parsed.organization;

// Set default list
var recursiveList = [ 'developers','apps','environments','apis','apiproducts' ];
data.parsed.list = data.parsed.list ? data.parsed.list.split(',') : recursiveList;

if ( !(data.parsed.username) || !(data.parsed.baseurl) || !(data.parsed.organization) || !(data.parsed.command) ) {
	console.log( 'username, baseurl, command and organization are all required parameters' );
	process.exit(1);
}

async.waterfall( [
	function(cb) {
		// Let's grab the pass if we don't already have it
		if ( !(data.parsed.password) ) {
			read({ prompt: 'Password: ', silent: true }, function(err, password) {
				if (err) {
					console.log( 'Failed to read password: %s', err );
					process.exit(1);
				}
				cb(null,password);
			});
		}
		else {
			cb(null,data.parsed.password);
		}
	},
	function(pass,cb) {
		data.parsed.password = pass;
		if ( data.parsed.command == "export" ) {
			main.export( data.parsed );
			cb( null, 'done' );
		}
		else if ( data.parsed.command == "import" ) {
			main.import( data );
			cb( null, 'done' );
		}
		else {
			console.log( 'Unknown command: ' + data.parsed.command );
			console.log( 'Command must be one of: import|execute' );
			cb( null, 'done' );
		}
	},
	function(err,res) {
		if ( !(err == "done") ) {
			console.log( 'I dun died here: %s', err );
		}
	}
]);
