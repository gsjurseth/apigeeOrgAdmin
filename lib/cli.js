var parser = require('argv-parser'),
	read	   = require('read'),
	async		 = require('async'),
	util		 = require('util'),
	path		 = require('path'),
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
		required: false,
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

data.parsed.baseurl = data.parsed.baseurl ? data.parsed.baseurl : 'https://api.enterprise.apigee.com';
data.parsed.orgUrl = data.parsed.baseurl + "/v1/o/" + data.parsed.organization;

// Set default list
var recursiveList = [ 'apis','apiproducts','developers','apps','environments','keyvaluemaps','userroles'];
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
			data.parsed.directory = path.join(data.parsed.directory,data.parsed.organization);
			main.export( data.parsed );
			cb( null, 'done' );
		}
		else if ( data.parsed.command == "import" ) {
			data.parsed.directory = path.join(data.parsed.directory,data.parsed.organization);
			main.import( data.parsed );
			cb( null, 'done' );
		}
		else {
			console.log( 'Unknown command: ' + data.parsed.command );
			console.log( 'Command must be one of: import|execute' );
			cb( null, 'done' );
		}
	}],
	function(err,res) {
		if (err) {
			console.log("Failed");
		}
	}
);
