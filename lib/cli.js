parser = require('argv-parser');
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
