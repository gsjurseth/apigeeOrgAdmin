var jf    = require('jsonfile'),
  util    = require('util'),
  request = require('request'),
  _       = require('underscore'),
  mkdirp  = require('mkdirp'),
  fs      = require('fs'),
  unzip   = require('unzip'),
  fstream = require('fstream'),
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

function getBundle( proxy ) {
  var url = main.opts.orgUrl + '/apis/' + proxy;

  // First we fetch the api proxy and get grab the latest revision
  request.get( url, main.opts.reqOpts, function(err,res,body) {
    // using the rev we set the url
    var jsonbody = JSON.parse(body);
    var rev = jsonbody.revision[ jsonbody.revision.length -1 ];
    var url = main.opts.orgUrl + '/apis/' + proxy + '/revisions/' + rev;
    main.opts.reqOpts.headers = { accept: 'application/zip', encoding: 'binary' };

    var r = request.defaults( main.opts.reqOpts );
    //With the latest revision in hand we fetch the actual proxy bundle
    r.get( { uri: url, encoding: 'binary'}, function(err, res, body) {
      if (err) {
        console.log( 'Failed fetching bundle: %s', err );
      }
      else {
        if (res.statusCode !== 200) {
          console.log( 'Received error %s when fetching proxy: %s', res.statusCode, body );
        }
        else {
          var destPath = main.opts.directory + '/apis/' + proxy;
          var f = (main.opts.directory + '/apis/' + proxy + '/' + proxy + '.zip' );

          //First write the file and then extract it
          async.series( [
            function(cb) {
              fs.writeFile(f, body, 'binary', function(err) {
                if (err) {
                  cb( { "operation" : "fetchingZIP", "message" : err }, null );
                }
                else {
                  console.log( "Saved file: %s", f );
                  cb(null,f);
                }
              });
            },
            function(cb) {
              var readStream = fs.createReadStream(f);
              var writeStream = fstream.Writer(destPath);

              readStream
                .pipe(unzip.Parse())
                .pipe(writeStream);
              cb(destPath);
            },
            function(err,results) {
              if (err) {
                console.log( "Failed: %s", util.inspect(err) );
              }
            }
          ]);
        }
      }
    });
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
    var dir = main.opts.directory + '/apis/' + proxy;
    mkdirp( dir, function(err) {
      if (err) {
        console.log('Failed to create dir: %s! -- %s', dir, err );
      }
      else {
        getBundle( proxy );
      }
    });
  });
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
  var recursiveList = [ 'developers','apps','environments','apis','apiproducts' ];
  //var recursiveList = [ 'developers','apps','environments','apis' ];
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
