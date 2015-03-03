var jf    = require('jsonfile'),
  util    = require('util'),
  request = require('request'),
  _       = require('underscore'),
  mkdirp  = require('mkdirp'),
  async   = require('async');

var opts;
module.exports = {
  import: Import,
  execute: Execute,
  opts: opts
}

function getRequestOptions( opts ) {
  var reqOpts = {};
  reqOpts.headers = { accept: 'application/json' };
  reqOpts.auth = {
    user: opts.username,
    pass: opts.password,
    sendImmediately: true
  };
  return reqOpts;
}

function getResource( type, cb ) {
  var url = main.opts.orgUrl + '/' + type;
  request.get( url, main.opts.reqOpts, function(err, res, body) {
    if (err) {
      console.log( 'I received this error: %s', err );
    }
    else if (res.statusCode == 200) {
      return cb(null, { 'type': type, result: JSON.parse(body) });
    }
    else {
      console.log( "Done received some other response: %s", util.inspect(res.statusCode) );
    }
  });
}

function handleResponse( results, recursive ) {
  if ( recursive ) {

    var newArr = _.map( results.result, function(i) { return results.type + '/' + i; } );

    async.map( newArr, getResource, function(err,res) {
      if (err) {
        console.log( "Failed to fetch results: %s", err );
      }
      else {
        handleResponse( res );
      }
    });
  }
  else {
    _.each( results, writeJsonFile );
  }
}

function writeJsonFile( result ) {
  jf.writeFile( main.opts.directory + '/' + result.type + '.json', result.result, function(err) {
    if (err) {
      console.log( "Failed to write file: " + err );
    }
  });
}

// Do the import bit of data ... Save each type as a separate file
function Import() {
  // First we do the recursive bits
  var recursiveList = [ 'developers','apps','environments','apis','apiproducts' ];
  this.opts.reqOpts = getRequestOptions( this.opts );
  async.map( recursiveList, getResource, function( err, results ) {
    if( err ) {
      console.log( 'This did not work at all: ' + err );
    }
    else {
      _.each( results, function(result) {
        var dir = main.opts.directory + '/' + result.type;
        mkdirp( dir, function(err) {
          if (err) {
            console.log('Failed to create dir: %s! -- %s', dir, err );
          }
        });
        handleResponse( result,true );
      });
    }
  });

  // Now we handle the org
  getResource( '', function( err, results) {
    if( err ) {
      console.log( "Failed to fetch info for organization: %s", err );
    }
    else {
      results.type = "organization";
      writeJsonFile(results);
    }
  });
}

// For each type update the configuration
function Execute() {
  console.log( util.inspect(data) );
}
