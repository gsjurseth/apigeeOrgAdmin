var jf      = require('jsonfile'),
  util      = require('util'),
  request   = require('request'),
  _         = require('underscore'),
  S         = require('string'),
  mkdirp    = require('mkdirp'),
  fs        = require('fs'),
  unzip     = require('unzip2'),
  ezip      = require('easy-zip2').EasyZip,
  path      = require('path'),
  fstream   = require('fstream'),
  log4js    = require('log4js'),
  async     = require('async');

var opts = {};
var doneWithApis = false;
// This is important for the developerId -> developerEmail mapping
var devList = {};
var appList = {};
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

  logger.debug( 'Determining latest revision info for proxy: %s', proxy );
  // First we fetch the api proxy and get grab the latest revision
  request.get( url, opts.reqOpts, function(err,res,body) {
    // using the rev we set the url
    var jsonbody = JSON.parse(body);
    var rev = jsonbody.revision[ jsonbody.revision.length -1 ];
    var url = opts.orgUrl + '/apis/' + proxy + '/revisions/' + rev;
    opts.reqOpts.headers = { accept: 'application/zip', encoding: 'binary' };

    logger.debug('Fetching proxy from url: %s', url );
    var r = request.defaults( opts.reqOpts );
    //With the latest revision in hand we fetch the actual proxy bundle
    r.get( { uri: url, encoding: 'binary'}, function(err, res, body) {
      if (err) {
        logger.error('Failed fetching proxy bundle: %s with error %s', proxy, err );
      }
      else {
        if (res.statusCode !== 200) {
          logger.error('getBundle received unexpected statuscode: %s for proxy %s with body: %s', res.statusCode, proxy, body );
        }
        else {
          var destPath = opts.directory + '/apis/' + proxy;
          var f = (opts.directory + '/apis/' + proxy + '/' + proxy + '.zip' );

          //First write the file and then extract it
          async.series( [
            function(cb) {
              fs.writeFile(f, body, 'binary', function(err) {
                if (err) {
                  logger.error('Failed to write proxy bundle file: %s and with error: %s', f, err );
                  cb( { "operation" : "fetchingZIP", "message" : err }, null );
                }
                else {
                  logger.debug('Saved file: %s', f );
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
              logger.info('Proxy bundle saved and extracted to: %s', destPath );
            },
            function(err,results) {
              if (err) {
                logger.error('Failed fetching proxy bundle with error: %s', err );
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

  logger.debug('Fetching json data from url: %s', url );

  request.get( url, opts.reqOpts, function(err, res, body) {
    if (err) {
      logger.error('Failed fetching json data from url: %s. Failed with error: %s', url, err );
    }
    else if (res.statusCode == 200) {
      logger.debug( 'Successfully fetched json for url: %s', url );
      var daBody = JSON.parse(body);

      /*
      if ( (type.split('/')[0]) == 'developers' ) {
        myGloriousDevLookup[daBody.developerId] = type.split('/')[1];
      }
      */
      cb(null, { 'type': type, result: daBody });
    }
    else {
      logger.error('getResource received unexpected response while fetching json for url: %s. Response code: %s', url, res.statusCode );
      logger.error('Received following error body: %s', body );
    }
  });
}

function handleAppFetch( proxyInfo ) {
  var daProxies = proxyInfo.result;
  _.each( daProxies, function(proxy) {
    logger.info('Fetching apiproxy: %s', proxy);
    var dir = opts.directory + '/apis/' + proxy;
    logger.debug('About to try and create dir for proxy: %s', dir );
    mkdirp( dir, function(err) {
      if (err) {
        logger.error('Failed to create dir: %s with error: %s', dir, err );
      }
      else {
        logger.debug('Created dir: %s and now calling getBundle for proxy: %s', dir, proxy );
        getBundle( proxy );
      }
    });
  });
}

function writeJsonFile( result ) {
  var daFile = opts.directory + '/' + result.type + '.json';
  var dirName = path.dirname(daFile);

  logger.debug( 'This is the result: %s', util.inspect( result, null, true ));

  mkdirp( dirName, function(err) {
    if (err) {
      logger.error('Failed to create dir: %s with error: %s', dir, err );
    }
    else {
      jf.writeFile( daFile, result.result, function(err) {
        if (err) {
          logger.error("failed to create json-file: %s with error: %s", daFile, err );
        }
        else {
          if (opts.debug) {
            logger.info( 'Writing json file: %s', daFile );
          }
        }
      });
    }
  });

}

function getJSON( list,callback ) {
  async.waterfall( [
    function(cb) {
      async.mapSeries( list, getResource, function( err, results ) {
        if (err) {
          logger.error("Failed in first waterflow action to fetch lists for map. Error: %s", err );
        }
        else {
          logger.debug('First waterflow action succeeded. Received: %s', results );
          cb(null,results);
        }
      });
    },
    function(results,cb) {
      async.mapSeries( results, function(res,daCallback) {
        var type = res.type;
        var newArr = _.map( res.result, function(i) { return res.type + '/' + i; } );
        logger.debug('Second waterflow action... Now handling list: %s', newArr );
        async.mapSeries( newArr, getResource, function(err,result) {
          if (err) {
            logger.error('Failed with 2nd fetch with error: %s', err );
          }
          else {
            logger.trace('Succeeded with 2nd fetch and with result: %s', util.inspect(result) );
            var multiResults = [];
            _.each( result, function(r) {
              if ( (r.type.split('/')[0]) == 'developers' ) {
                devList[ r.result.developerId ] = r.type.split('/')[1];
                devList[ r.type.split('/')[1] ] = r.result.developerId;
              }
              if ( (r.type.split('/')[0]) == 'apps' ) {
                appList[ r.type.split('/')[0] ] = r.result.name;
                appList[ r.result.name ] = r.type.split('/')[0];
                r.result.developerEmail = devList[ r.result.developerId ];

                //Also switching to the actual appName instead of the dumb appId
                multiResults.push( { type: 'apps/' + r.result.name, result: r.result } );
              }
            });
            if (multiResults.length > 0 ){
              result = multiResults;
            }
            logger.debug('This is devList: %s', util.inspect(devList) );
            daCallback(null,result);
          }
        });
      }, function(err,res) {
        cb(null,res);
      });
    }
  ],
  function( err,res ) {
    logger.debug('Finished fetching resources. Result set is: %s', util.inspect(res,true,null) );
    callback(res);
  });
}

// Do the import bit of data ... Save each type as a separate file
function Export( daOpts ) {
  opts = daOpts;

  // Setup our logging
  logger = log4js.getLogger();
  if ( opts.debug ) {
    logger.setLevel('TRACE');
  }
  else {
    logger.setLevel('INFO');
  }

  logger.debug('Entering Export method' );

  // Strip the 'apis' element from the list if it's there. We handle it later
  var listWithoutAPIS = _.reject( opts.list, function(c) { if (c == 'apis') return true; });
  logger.trace('Excluded %s from list. List to handle is now: %s', 'apis', listWithoutAPIS );
  getJSON( listWithoutAPIS, function(res) {
    _.each(res,function(types) {
      _.each(types,function(type) {
        logger.info( 'Working on type: %s', type.type );
        writeJsonFile( type );
      });
    });
  });

  // Special case for apis
  if (_.contains(opts.list, 'apis') ) {
    logger.info('Now exporting apis');
    getResource( 'apis', function(err,results) {
      handleAppFetch( results );
    });
  }

  // Now we handle the org
  getResource( '', function( err, results) {
    if( err ) {
      logger.error('Failed to fetch json for organization: %s and with error: %s', opts.organization, err );
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
            logger.fatal('No targets found... Got an ENOENT');
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
          logger.debug('Reading json file: %s', daPath );
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

  // Complicated stuff for special use cases...
  if ( (type.split('/')[0] == "apps") && ((_.has( body,'developerEmail' ))) ) {
    logger.debug('WootWoot -> type: %s -> verg: %s', type,verb );
    var newBody = {};
    var apiProducts = _.map( body.credentials[0].apiProducts, function(i) { return i.apiproduct; } );
    body.developerId = devList[ body.developerEmail ];
    body.apiProducts = apiProducts;
    if ( verb == 'POST' ) {
      url = opts.orgUrl + '/developers/' + body.developerEmail + '/apps';
      newBody.apiProducts = body.apiProducts;
    }
    else {
      url = opts.orgUrl + '/developers/' + body.developerEmail + '/apps/' + body.name ;
      newBody.credentials = body.credentials;
      newBody.apiProducts = [];
    }
    delete body.developerEmail;
    newBody.name = body.name;
    newBody.callbackUrl = body.callbackUrl;
    newBody.attributes  = body.attributes;
    body = newBody;
  }

  logger.debug('Updating by %s:ing url: %s and with body: %s', verb,url,util.inspect(body,true,null) );
  opts.reqOpts = getRequestOptions( opts );

  logger.info('Updating resource with url: %s', url );
  logger.debug('Updating resource: %s with body: %s', type, util.inspect(body) );
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
      logger.error('updateConfig received unexpected error while \"%s\":ing config for type: %s. Error: %s and Response: %s', verb, type, err, res );
    }
    else if ( (res.statusCode == 200) || (res.statusCode == 201) ) {
      logger.debug('Succeeded updating: %s with statusCode: %s', type, res.statusCode );
      cb(null, { 'type': type, result: JSON.parse(body) });
    }
    else {
      logger.error('updateConfig received unexpected status code while \"%s\":ing for type: %s and statusCode: %s and with body: %s', verb, type, res.statusCode, res.body );
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
      else if ( _.has(devList,element) ) {
        ret = true;
      }
      else if ( _.has(appList,element) ) {
        ret = true;
      }
    });
  });
  return ret;
}

function createProxyBundle( src,cb ) {
  var zip = new ezip();
  var proxyName = path.basename(src);
  var daFile = path.join( src, proxyName + '.zip' );
  zip.zipFolder( path.join(src, 'apiproxy'), function() {
    var data = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });
    //zip.writeToFile( daFile );
    cb( null, { 'proxyName' : proxyName, 'data' : data });
  });
}

function createBundles( dir,cb ) {
  try {
    fileNames = _.filter( fs.readdirSync(dir), function(proxyDir) {
      var fullpath = path.join(dir,proxyDir,'apiproxy');
      if ( fs.existsSync(fullpath) ) {
        return proxyDir;
      }
      else {
        logger.warn( "%s doesn't appear to be a valid proxy dir .. Skipping!", proxyDir );
        return false;
      }
    });
    logger.debug('Found the following api-directories: %s', fileNames );
  }
  catch(e) {
    if (e.code === 'ENOENT') {
      logger.error('Received ENOENT: %s', util.inspect(e) );
      cb();
    }
    else {
      cb(e);
    }
    return;
  }

  async.map( fileNames,
    function(daDir,thisCallback) {
      logger.debug('Calling: createProxyBundle for dir: %s', daDir );
      createProxyBundle( path.join( opts.directory, 'apis', daDir),thisCallback )
    },
    function(err,res) {
      if (err) {
        logger.error('Failed to create proxy bundle from dir: %s and with error: %s', daDir, err );
      }
      else {
        logger.trace( 'Succeeded in creating bundle. Result is: %s', util.inspect(res) );
        cb( null,res );
      }
    }
  );
}

function postProxy( proxy, cb ) {
  var url = util.format('%s/apis?action=import&validate=false&name=%s', opts.orgUrl,proxy.proxyName );

  opts.reqOpts = getRequestOptions( opts );

  request({
      uri: url,
      headers: { "Content-Type": "application/octet-stream" },
      json: false,
      auth: opts.reqOpts.auth,
      method: 'POST',
      body: proxy.data
    },
    function(err, res, body) {
    if (err) {
      logger.error('Failed updating proxy: %s with error: %s', proxy, err );
    }
    else if ( (res.statusCode == 200) || (res.statusCode == 201) ) {
      logger.debug('Proxy added: %s', util.inspect(proxy) );
      cb( null, 'Done adding proxy: ' + proxy );
    }
    else {
      logger.error( "Received unexpected response while importing proxy zip: %s and with body: %s", res.statusCode, res.body );
    }
  });
}

function emailForDeveloperId( id ) {
}

// For each type update the configuration
function Import( daOpts ) {
  opts = daOpts;

  // Setup our logging
  logger = log4js.getLogger();
  if ( opts.debug ) {
    logger.setLevel('TRACE');
  }
  else {
    logger.setLevel('INFO');
  }

  var listWithoutAPIS = _.reject( opts.list, function(c) { if (c == 'apis') return true; });
  //async.waterfall: get current state and pass to processing for creating/updating
  async.waterfall( [
    function(dcb) {
      //as with export .. skip 'apis' for now. we handle it special later
      getJSON( listWithoutAPIS, function(res) {
        dcb(null,res);
      });
    },
    // Read the jsonfiles
    function(res,dcb) {
      originalJSON = res;
      readJSONFiles( listWithoutAPIS, function(err,resFiles) {
        dcb(null,{ orig: res, files: resFiles } );
      });
    },
    // Update in series --> excluding the api-bundles
    function(res,dcb) {
      async.series( [
        function(cb) {
          _.each( res.files, function(types) {
            _.each( types, function(type) {
              var element = type.type.split('.json')[0];
              if ( checkIfExists(res.orig, element) ) {
                logger.info('Updating existing resource: %s', element );
                updateConfig( element, 'PUT', type.result, cb );
              }
              else {
                var element = type.type.split('.json')[0].split('/')[0];
                logger.info('Creating brand new resource: %s', element);
                updateConfig( element, 'POST', type.result, cb );
              }
            });
          });
          cb(null,'doneWithJSON');
        }],
        function(err,res) {
          if (err) {
            logger.fatal('Failed while updating JSON: %s', util.inspect(err) );
            dcb( "failed before testing for api-bunbles", null );
          }
        });
        dcb( null, 'apis' );
      },
      // now we do the bundles
      function(res,dcb) {
        if (_.contains(opts.list,"apis")) {
          // now for complicated zipped up sit
          logger.error('calling create bundles');
          createBundles( path.join(opts.directory,'apis'), dcb );
        }
        else {
          dcb( 'APIs not in the list of handlers', null );
        }
      },
      function(res,dcb) {
        logger.debug('About to update proxy list: %s', util.inspect(res) );
        async.map( res, postProxy, function(err,res) {
          if (err) {
            logger.error('Failed updating org with error: %s', err );
          }
          else {
            logger.debug('Finished and received result: %s', res );
            dcb(null,'done');
          }
        });
      }
    ],
    function(err,res) {
      logger.info( 'this is the end ... ' );
    });
}
