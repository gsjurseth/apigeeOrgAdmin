var jf      = require('jsonfile'),
  util      = require('util'),
  request   = require('request'),
  _         = require('underscore'),
  mkdirp    = require('mkdirp'),
  fs        = require('fs'),
  unzip     = require('unzip2'),
  ezip      = require('easy-zip2').EasyZip,
  path      = require('path'),
  fstream   = require('fstream'),
  async     = require('async');

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
  //var url = path.join(opts.orgUrl,type);

  opts.reqOpts = getRequestOptions( opts );

  if (opts.debug) {
    console.log( 'About to fetch data for path: %s', url );
    console.log( 'Using options: %s', util.inspect(opts.reqOpts) );
  }
  request.get( url, opts.reqOpts, function(err, res, body) {
    if (err) {
      console.log( 'I received this error: %s and with the following opts: %s', err, util.inspect(opts) );
      console.log( 'Requested url: %s', url );
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

function getJSON( list,callback ) {
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
    callback(res);
  });
}

// Do the import bit of data ... Save each type as a separate file
function Export( daOpts ) {
  opts = daOpts;
  // First we do the recursive bits
  if (opts.debug) {
    console.log( 'About to start exporting based on this list: %s', util.inspect(opts.list) );
  }

  // Strip the 'apis' element from the list if it's there. We handle it later
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

function readFile( type,cb ) {

  var theFullPath = path.join( opts.directory,type );
  var daFile = jf.readFileSync(theFullPath);
  cb( null,{ 'type': type, 'result': daFile } );
}

function readJSONFiles( list,callback ) {
  async.map( list,
    function(type, cb) {
      var fileNames = [];
      var dir = path.join(opts.directory, type);
      try {
        fileNames = fs.readdirSync(dir)
      }
      catch(e) {
        if (e.code === 'ENOENT') {
          if (opts.verbose) {
            console.log('No targets found');
          }
          cb();
        }
        else {
          cb(e);
        }
        return;
      }
      async.map( fileNames,
        function(file,dcb) {
          var daPath = path.join(type,file);
          console.log( 'the path: %s', daPath );
          readFile(daPath,dcb);
        },
        function(err,res) {
          cb(null,res);
        }
      );
    },
    function(err,res) {
      if ( err ) {
        callback(err);
      }
      else {
        callback(null,res);
      }
    }
  );
}

// Update the config
function updateConfig( type, verb, body, cb ) {
  //var url = path.join( opts.orgUrl,type );
  var url = opts.orgUrl + '/' + type;

  opts.reqOpts = getRequestOptions( opts );

  if (opts.debug) {
    console.log( 'About to update for path: %s', url );
    console.log( 'Sending body: %s', util.inspect(body) );
  }
  request({
      uri: url,
      headers: {
        "Content-Type": "application/json",
        "accept" : "application/json"
      },
      auth: opts.reqOpts.auth,
      method: verb,
      body: JSON.stringify(body)
    },
    function(err, res, body) {
    if (err) {
      console.log( 'I received this error: %s and with the following body: %s', err, res );
    }
    else if ( (res.statusCode == 200) || (res.statusCode == 201) ) {
      cb(null, { 'type': type, result: JSON.parse(body) });
    }
    else {
      console.log( "Received another response while trying to update config: %s", res.statusCode );
      console.log( "Received this error body: %s", util.inspect(res.body) );
    }
  });
}

// used to see if the path already exists .. in that case we do a put and not POST
function checkIfExists( orig,element ) {
  var ret = false;
  _.each( orig, function(arrs) {
    _.each( arrs, function(types) {
      if (types.type == element) {
        ret = true;
      }
    });
  });
  return ret;
}

function createProxyBundle( src,cb ) {
  var zip = new ezip();
  var daFile = path.join( src, path.basename(src) + '.zip' );
  console.log('the src luke: %s', daFile );
  zip.zipFolder( path.join(src, 'apiproxy'), function() {
    zip.writeToFile( daFile );
    cb( null,daFile );
  });
}

function createBundles( dir,cb ) {
  try {
    fileNames = fs.readdirSync(dir)
  }
  catch(e) {
    if (e.code === 'ENOENT') {
      if (opts.verbose) {
        console.log('No targets found');
      }
      cb();
    }
    else {
      cb(e);
    }
    return;
  }

  async.map( fileNames,
    function(daDir,cb) {
      createProxyBundle( path.join( opts.directory, 'apis', daDir),cb )
    },
    function(err,res) {
      if (err) {
        console.log("Failed whiel creating proxy bundles: %s", err);
      }
      else {
        console.log('Created zips for bundles: %s', util.inspect(res) );
      }
    }
  );
}

// For each type update the configuration
function Import( daOpts ) {
  opts = daOpts;

  var originalJSON;
  var listWithoutAPIS = _.reject( opts.list, function(c) { if (c == 'apis') return true; });
  //async.waterfall: get current state and pass to processing for creating/updating
  async.waterfall( [
    function(cb) {
      //as with export .. skip 'apis' for now. we handle it special later
      getJSON( listWithoutAPIS, function(res) {
        cb(null,res);
      });
    },
    function(res,cb) {
      originalJSON = res;
      readJSONFiles( listWithoutAPIS, function(err,resFiles) {
        cb(null,{ orig: res, files: resFiles } );
      });
    },
    function(res,dcb) {
      async.series( [
        // Simple non-proxy bundle shit
        function(cb) {
          _.each( res.files, function(types) {
            _.each( types, function(type) {
              var element = type.type.split('.json')[0];
              if ( checkIfExists(res.orig, element) ) {
                if (opts.debug) {
                  console.log('Performing update on element: %s', element );
                }
                updateConfig( element, 'PUT', type.result, cb );
              }
              else {
                var element = type.type.split('.json')[0].split('/')[0];
                if (opts.debug) {
                  console.log('Trying to create element: %s', element );
                }
                updateConfig( element, 'POST', type.result, cb );
              }
            });
          });
          cb(null,'doneWithJSON');
        },
        function (cb) {
          // now for complicated zipped up sit
          createBundles( path.join(opts.directory,'apis'), cb );
        }],
        function(err,res) {
          if (err) {
            console.log('well, we failed with: %s', util.inspect(err) );
          }
          else {
            if (opts.debug) {
              console.log( 'Successfully imported da-stuff' );
            }
          }
        });
      dcb(null, 'done');
    }
  ],
  function(err,res) {
    console.log( 'this is the end ... ' );
  });
}
