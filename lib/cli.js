parser = require('argv-parser');
read	 = require('read');
main   = require('./main');

var rules = {
	organization: {
		type: String,
		required: true,
		short: 'o'
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
};
var data = parser.parse( process.argv, { rules: rules } );

data.parsed.orgUrl = data.parsed.baseurl + "/v1/o/" + data.parsed.organization;

main.opts = data.parsed;

if ( !(data.parsed.username) || !(data.parsed.baseurl) || !(data.parsed.organization) || !(data.parsed.command) ) {
	console.log( 'username, baseurl, command and organization are all required parameters' );
	process.exit(1);
}

// Let's grab the pass if we don't already have it
if ( !(data.parsed.password) ) {
	read({ prompt: 'Password: ', silent: true }, function(err, password) {
		if (err) {
			console.log( 'Failed to read password: %s', err );
			process.exit(1);
		}
		data.parsed.password = password;
	});
}

if ( data.parsed.command == "import" ) {
	main.import( data );
}
else if ( data.parsed.command == "execute" ) {
	main.execute( data );
}
else {
	console.log( 'Unknown command: ' + data.parsed.command );
	console.log( 'Command must be one of: import|execute' );
}
