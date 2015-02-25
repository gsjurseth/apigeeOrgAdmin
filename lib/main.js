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
      console.log(err);
    }
    else if (res.statusCode == 200) {
      cb(null, { 'type': type, result: JSON.parse(body) });
    }
  });
}

function handleResponse( results, recursive ) {
  var newArr = _.map( results[0].result, function(i) {
    return results[0].type + '/' + i;
  });

  if ( recursive ) {
    async.map( newArr, getResource, function( err, results ) {
      if( err ) {
        console.log( 'This did not work at all: ' + err );
      }
      else {
        handleResponse( results );
        //console.log( 'These are the results: ' + util.inspect(results) );
      }
    });
  }
  else {
    _.each( results, writeJsonFile );
    //console.log( 'Da results: ' + util.inspect(results[1].result) );
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
  var recursiveList = [ 'apps' ];
  this.opts.reqOpts = getRequestOptions( this.opts );
  async.map( recursiveList, getResource, function( err, results ) {
    if( err ) {
      console.log( 'This did not work at all: ' + err );
    }
    else {
      var dir = main.opts.directory + '/' + results[0].type;
      mkdirp( dir, function(err) {
        if (err) {
          console.log('Failed to create dir: %s! -- %s', dir, err );
        }
      });
      handleResponse( results,true );
    }
  });

  // And now the singular elements
  //async.map( recursiveList, getResource, handleResponse( err, results ) );
}

// For each type update the configuration
function Execute() {
  console.log( util.inspect(data) );
}
