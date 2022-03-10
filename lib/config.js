//jshint esversion:9
//jshint node:true
/**
 * Config file for the ages
 */
const path = require( 'path' );
const fs = require( 'fs' );
const { merge, get } = require( 'lodash' );
const debug = require( 'debug' )( 'lib:config' );

// The config path
const defaultConfigPath = path.join( __dirname, '../config/default.json' );
const localConfigPath = path.join( __dirname, '../config/local.json' );

// Our exported module
const that = module.exports = {};

try {
	// Load the default static stuff
	that.static = JSON.parse( fs.readFileSync( defaultConfigPath ) );
}
catch( e ) {
	console.error( "Unable to load the default config '%s'.", defaultConfigPath );
}

// Some static config items
that.static = merge( {}, that.static, {
	'env' : process.env.NODE_ENV || "development",
	'production' : process.env.NODE_ENV=="production",
	'path' : {
		'root' : path.join( __dirname, ".." ) // Up all of the way to the top
	}
} );

// The actual config
// As it starts off as empty.
let c;

/**
 * Our config loader and creator
 */
that.get = async function( path, defaultValue ) {
	// Do we have a config loaded?
	if( !c )
		await that.loadConfig(); // Lazy load it
	
	// Now get what we need
	return( get( c, args, defaultValue ) );
};

/**
 * Save these items to the config
 */
that.put = async function( data ) {
	// The config to merge with
	let myC;

	// Load the local config first
	try {
		// Load the data and parse
		const loadedConfig = JSON.parse( await fs.promises.readFile( localConfigPath ) );

		// Merge it
		myC = merge( {}, myC );
	}
	catch( e ) {
		console.warn( "Error loading local config '%s' to write to it.", localConfigPath, e );
	}

	// Now merge what we want to save into it
	myC = merge( {}, myC, data );

	// Debug it
	debug( "New config to write", myC );

	// Make into JSON
	const json = JSON.stringify( myC, null, 2 );

	// Now write it
	// And let it throw and don't catch if there's an issue
	await fs.promises.writeFile( localConfigPath, json );

	// Kick off a reload to the new config
	await that.loadConfig();
};

/**
 * Load the config
 */
that.loadConfig = async function() {
	// Empty c
	c = null;

	// Loop and load each
	try {
		// Load the config requested
		const loadedConfig = JSON.parse( await fs.promises.readFile( localConfigPath ) );

		// Now merge it
		// I know this function mutates the first argument.
		// I just felt better about creating a new object
		// every time.
		c = merge( {}, c, loadedConfig );
	}
	catch( e ) {
		// Successfully fail
		console.warn( "Error loading local config file '%s'", localConfigPath, e );
	}

	// Merge with the static config stuff
	c = merge( {}, c, that.static );

	debug( "We have config.", c );
};
