//jshint esversion:9
//jshint node:true

const path = require( 'path' );
const fs = require( 'fs' );

const scriptName = path.basename( __filename );

const debug = require( 'debug' )( "database:models:index" );

// Our function
module.exports = function( db ) {
	// Read each file
	for( let file of fs.readdirSync( __dirname ) ) {
		if( file==scriptName ) {
			debug( "Ignoring our file", file );
			continue;
		}
		else if( !/\.js$/i.test( file ) ) {
			debug( "Ignorning non-js file", file );
			continue;
		}

		debug( "Including file", file );
		
		// The path
		file = path.join( __dirname, file );

		// Now require it and call it
		require( file )( db );
	}
};
