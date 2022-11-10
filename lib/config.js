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

// Get the local config file
const DefaultConfigFile = path.join( __dirname, '../config/default.json' );
const DefaultConfigFilePath = path.join( __dirname, '../config/default' );

// Empty config
let defaultConfigFile = {};

// Create the default config
{
	// Read all json files
	const files = fs.readdirSync( DefaultConfigFilePath );

	// Compile them in to one massive file
	for( const file of files ) {
		debug( "Found file", file );
		// Skip non JSON files
		if( !/\.json$/i.test( file ) ) {
			debug( "file %s not json. skpping.", file );
			continue;
		}

		// Now read it 
		const filename = path.join( DefaultConfigFilePath, file );

		debug( "Reading default config file", filename );

		// Load the JSON
		const json = fs.readFileSync( filename );

		// Now convet to data
		const data = JSON.parse( json );

		// Append to the config
		defaultConfigFile = merge( {}, defaultConfigFile, data );
	}
}

// The actual config
let config = defaultConfigFile;

// The user's config file
const LocalConfigFile = path.join( __dirname, '../config/local.json' );

try {
	const localConfig = JSON.parse( fs.readFileSync( LocalConfigFile ) );
	// Combine ES6
	config = merge( {}, config, localConfig );
}
catch( e ) {
	console.warn( "Error reading the local config file.", e );
}

// Set the root path
const root = config.path.root = path.join( __dirname, ".." ); // Up all of the way to the top

// Map the paths
config.path = reduce( config.path, ( a, v, k )=>( { ...a, [ k ] : path.resolve( root, v ) } ), {} );

// Add the config file
config.path.defaultConfigFile = defaultConfigFile;
config.path.localConfigFile = LocalConfigFile;

debug( "config.path=", config.path );

config.env = process.env.NODE_ENV || "development";
config.production = config.env=="production";
config.hostname = hostname;

debug( "We are using production.", config.production );

debug( "We have config.", config );

// Export the config options
module.exports = config;
