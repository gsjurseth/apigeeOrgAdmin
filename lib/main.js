var jf    = require('jsonfile'),
  util    = require('util'),
  request = require('request'),
  _       = require('underscore'),
  mkdirp  = require('mkdirp'),
  fs      = require('fs'),
  async   = require('async');

var opts;
module.exports = {
  import: Import,
  export: Export,
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

function getBundle( proxy, rev ) {
  var url = main.opts.orgUrl + '/apis/' + proxy + '/revisions/' + rev;
  main.opts.reqOpts.headers = { accept: 'application/zip' };
  main.opts.encoding = 'binary';
  request.get( url, main.opts.reqOpts, function(err, res, body) {
    if (err) {
      console.log( 'Failed fetching bundle: %s', err );
    }
    else {
      if (opts.debug) {
        console.log ( 'Received: ' + res.statusCode + ' the following headers: ' + JSON.stringify(res.headers) );
      }
      if (res.statusCode !== 200) {
        console.log( 'Received error %s when fetching proxy: %s', res.statusCode, body );
      }
      else {
        var f = (main.opts.directory + '/apis/' + proxy + '/' + proxy + '.zip' );
        fs.writeFile(f, body, 'binary', function(err) {
        if (err) {
            console.log( "Failed to write file: " + f );
            console.log( "Error text: " + err );
        }
        else {
            console.log( 'Save file: ' + f );
        }
      });
    }
    }
  });
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

function handleAppFetch( proxyInfo ) {
  var daProxies = proxyInfo.result;
  _.each( daProxies, function(proxy) {
    var dir = main.opts.directory + '/apiproxies/' + proxy;
    mkdirp( dir, function(err) {
      if (err) {
        console.log('Failed to create dir: %s! -- %s', dir, err );
      }
      else {

      }
    });
  });
  async.map( proxyInfo.result,function(i,cb) {

  }, function(){});
  console.log( util.inspect(proxyInfo) );
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
function Export() {
  // First we do the recursive bits
  //var recursiveList = [ 'developers','apps','environments','apis','apiproducts' ];
  var recursiveList = [ 'developers','apps','environments','apis' ];
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
        if (result.type != 'apis') {
          handleResponse( result,true );
        }
        else {
          handleAppFetch( result );
        }
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
function Import() {
  console.log( util.inspect(data) );
}
