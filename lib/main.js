var jf    = require('jsonfile'),
  util    = require('util'),
  request = require('request'),
  _       = require('underscore'),
  mkdirp  = require('mkdirp'),
  fs      = require('fs'),
  unzip   = require('unzip2'),
  path    = require('path'),
  fstream = require('fstream'),
  async   = require('async');

var opts = {};
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
  var url = opts.orgUrl + '/apis/' + proxy;

  if (opts.debug) {
    console.log( 'About to fetch revision info for proxy: %s', proxy );
  }
  // First we fetch the api proxy and get grab the latest revision
  request.get( url, opts.reqOpts, function(err,res,body) {
    // using the rev we set the url
    var jsonbody = JSON.parse(body);
    var rev = jsonbody.revision[ jsonbody.revision.length -1 ];
    var url = opts.orgUrl + '/apis/' + proxy + '/revisions/' + rev;
    opts.reqOpts.headers = { accept: 'application/zip', encoding: 'binary' };

    if (opts.debug) {
      console.log( 'About to fetch proxy at path: %s', url );
    }
    var r = request.defaults( opts.reqOpts );
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
          var destPath = opts.directory + '/apis/' + proxy;
          var f = (opts.directory + '/apis/' + proxy + '/' + proxy + '.zip' );

          //First write the file and then extract it
          async.series( [
            function(cb) {
              fs.writeFile(f, body, 'binary', function(err) {
                if (err) {
                  cb( { "operation" : "fetchingZIP", "message" : err }, null );
                }
                else {
                  if (opts.debug) {
                    console.log( "Saved file: %s", f );
                  }
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
              if (opts.debug) {
                console.log( 'Unarchived bundle to: %s', destPath );
              }
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
  var url = opts.orgUrl + '/' + type;

  if (opts.debug) {
    console.log( 'About to fetch data for path: %s', url );
  }
  request.get( url, opts.reqOpts, function(err, res, body) {
    if (err) {
      console.log( 'I received this error: %s and with the following opts: %s', err, util.inspect(opts) );
    }
    else if (res.statusCode == 200) {
      cb(null, { 'type': type, result: JSON.parse(body) });
    }
    else {
      console.log( "Done received some other response: %s", util.inspect(res.statusCode) );
    }
  });
}

function handleAppFetch( proxyInfo ) {
  var daProxies = proxyInfo.result;
  _.each( daProxies, function(proxy) {
    var dir = opts.directory + '/apis/' + proxy;
    mkdirp( dir, function(err) {
      if (err) {
        console.log('Failed to create dir: %s! -- %s', dir, err );
      }
      else {
        getBundle( proxy );
      }
    });
  });
}

function writeJsonFile( result ) {
  var daFile = opts.directory + '/' + result.type + '.json';
  var dirName = path.dirname(daFile);

  mkdirp( dirName, function(err) {
    if (err) {
      console.log('Failed to create dir: %s! -- %s', dir, err );
    }
    else {
      //getBundle( proxy );
      jf.writeFile( daFile, result.result, function(err) {
        if (err) {
          console.log( "Failed to write file: " + err );
        }
        else {
          if (opts.debug) {
            console.log( 'Writing json to file: %s', daFile );
          }
        }
      });
    }
  });

}

function getJSON( list,cb ) {
  async.waterfall( [
    function(cb) {
      async.map( list, getResource, function( err, results ) {
        if (err) {
          console.log( 'Failed while doing initial fetch' );
        }
        else {
          if (opts.debug) {
            console.log( 'Fetched following: %s', util.inspect(results) );
          }
          cb(null,results);
        }
      });
    },
    function(results,cb) {
      async.map( results, function(res,daCallback) {
        var type = res.type;
        var newArr = _.map( res.result, function(i) { return res.type + '/' + i; } );
        async.map( newArr, getResource, function(err,result) {
          if (err) {
            console.log( "Failed to fetch results: %s", err );
          }
          else {
            daCallback(null,result);
          }
        });
      }, function(err,res) {
        cb(null,res);
      });
    }
  ],
  function( err,res ) {
    cb(res);
  });
}

// Do the import bit of data ... Save each type as a separate file
function Export( daOpts ) {
  opts = daOpts;
  // First we do the recursive bits
  if (opts.debug) {
    console.log( 'About to start exporting based on this list: %s', util.inspect(opts.list) );
  }
  opts.reqOpts = getRequestOptions( opts );

  var listWithoutAPIS = _.reject( opts.list, function(c) { if (c == 'apis') return true; });
  getJSON( listWithoutAPIS, function(res) {
    _.each(res,function(types) {
      _.each(types,function(type) {
        writeJsonFile( type );
      });
    });
  });

  // Special case for apis
  if (_.contains(opts.list, 'apis') ) {
    getResource( 'apis', function(err,results) {
      handleAppFetch( results );
    });
  }

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
function Import( daOpts ) {
  opts = daOpts;
}
