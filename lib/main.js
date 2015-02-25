var jf    = require('jsonfile'),
  util    = require('util'),
  request = require('request'),
  async   = require('async');

module.exports = {
  import: Import,
  execute: Execute,
  opts: {}
}

function setRequestOptions( data ) {
  var opts = {};
  opts.headers = { accept: 'application/json' };
  opts.auth = {
    user: data.parsed.username,
    pass: data.parsed.password,
    sendImmediately: true
  };
  return opts;
}

function getResource( opts, cb ) {
  request.get( opts, function(err, res, body) {
    if (err) {
      console.log(err);
    }
    else if (res.statusCode == 200) {
      console.log( util.inspect(body) );
      cb(null, JSON.parse(body));
    }
  });
}

// Do the import bit of data ... Save each type as a separate file
function Import( data ) {
  var opts = setRequestOptions( data );
  async.map( [ { apps : { recurse: false } } ], getResource,

  )
  getResource( data.parsed.orgUrl + '/apps', returnRequestOptions(data) );
}

// For each type update the configuration
function Execute( data ) {
  console.log( util.inspect(data) );
}
