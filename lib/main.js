var jf = require('jsonfile');
var util = require('util');

module.exports = {
  import: Import,
  execute: Execute
}

function Import( data ) {
  console.log( util.inspect(data) );
}

function Execute( data ) {
  console.log( util.inspect(data) );
}
