//jshint esversion:9
//jshint node:true
/**
 * Config file for the ages
 */
const path = require( 'path' );
const fs = require( 'fs' );
const os = require( 'os' );
const { merge, reduce } = require( 'lodash' );
const debug = require( 'debug' )( 'lib:config' );

// Get from our environment
const hostname = os.hostname();

// Get the local file
const DefaultConfigFile = path.join( __dirname, '../config/default.json' );
const LocalConfigFile = path.join( __dirname, '../config/local.json' );

let config = JSON.parse( fs.readFileSync( DefaultConfigFile ) );

try {
	const localConfig = JSON.parse( fs.readFileSync( LocalConfigFile ) );
	// Combine ES6
	config = merge( config, localConfig );
}
catch( e ) {
	console.warn( "Error reading the local config file.", e );
}

// Set the root path
const root = config.path.root = path.join( __dirname, ".." ); // Up all of the way to the top

// Map the paths
config.path = reduce( config.path, ( a, v, k )=>( { ...a, [ k ] : path.resolve( root, v ) } ), {} );

// Add the config file
config.path.defaultConfigFile = DefaultConfigFile;
config.path.localConfigFile = LocalConfigFile;

debug( "config.path=", config.path );

config.env = process.env.NODE_ENV || "development";
config.production = config.env=="production";
config.hostname = hostname;

debug( "We are using production.", config.production );

debug( "We have config.", config );

// Export the config options
module.exports = config;
