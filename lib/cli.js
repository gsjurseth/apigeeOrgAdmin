#!/usr/bin/env node
var parser = require('argv-parser'),
	read	   = require('read'),
	async		 = require('async'),
	util		 = require('util'),
	path		 = require('path'),
	log4js	 = require('log4js'),
	main     = require('./main');

var logger = log4js.getLogger();
logger.setLevel('INFO');

var rules = {
	help: {
		type: Boolean,
		required: false,
		short: 'h'
 	},
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

function doHelp() {
	console.log( "Used to manage an apigee organization either in the cloud or local installation ---" );
	console.log( "%s -o|--organization <orgname> -u|--username <username|email> -d|--directory <output-directory> -c|--command <import|export> [-p|--password <password>] [-b|--baseurl <http://mgmt-server:port>] [-D|--debug] [-l|--list <your,own,list,of,resources,to,handle>] [-h|--help]", process.argv[1] );
	process.exit(1);
}

var data = parser.parse( process.argv, { rules: rules } );

if ( data.parsed.help) {
	doHelp();
}

// Handle logging
if (data.parsed.debug) {
	logger.setLevel('TRACE');
}


data.parsed.baseurl = data.parsed.baseurl ? data.parsed.baseurl : 'https://api.enterprise.apigee.com';
data.parsed.orgUrl = data.parsed.baseurl + "/v1/o/" + data.parsed.organization;

// Set default list
var recursiveList = [ 'apis','apiproducts','developers','apps','environments','userroles'];
data.parsed.list = data.parsed.list ? data.parsed.list.split(',') : recursiveList;

if ( !(data.parsed.username) || !(data.parsed.baseurl) || !(data.parsed.organization) || !(data.parsed.command) ) {
	doHelp();
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
			logger.info('About to run export for list: %s', data.parsed.list );
			data.parsed.directory = path.join(data.parsed.directory,data.parsed.organization);
			main.export( data.parsed );
			cb( null, 'done' );
		}
		else if ( data.parsed.command == "import" ) {
			logger.info('About to run import for list: %s', data.parsed.list );
			data.parsed.directory = path.join(data.parsed.directory,data.parsed.organization);
			main.import( data.parsed );
			cb( null, 'done' );
		}
		else {
			logger.fatal('Unknown command: %s', data.parsed.command );
			logger.info( 'Command must be one of: import|execute' );
			cb( null, 'done' );
		}
	}],
	function(err,res) {
		if (err) {
			logger.error('Failed while running command: %s and with error: %s', data.parsed.command,err );
			console.log("Failed");
		}
	}
);
