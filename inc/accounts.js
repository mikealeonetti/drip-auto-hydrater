//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const { isEmpty, map, isArray, size } = require( 'lodash' );

const fs = require( 'fs' );
const path = require( 'path' );

const log = require( '../lib/logger' );

const debug = require( 'debug' )( "inc:accounts" );

const FaucetAccount = require( '../drivers/faucet' );
const GardenAccount = require( '../drivers/garden' );

// Do in a look in cast there is an error on this
try {
	// Create accounts for everybody
	const accounts = map( config.accounts, account=>{
		// This can be done with an array FYI
		const driver = path.join( __dirname, "../drivers", account.driver )+".js";

		debug( "We have the driver path", driver );

		// Does it exist?
		try {
			// Can we access it
			fs.accessSync( driver );
		}
		catch( e ) {
				log.message.error( "Account [%s] has unrecognized driver '%s' (path: %s).", account.key, account.driver, driver, e );
				process.exit( 1 );
		}

		// The drier
		const C = require( driver );

		return( new C( account ) );
	} ).filter( account=>account.enabled );

	// No accounts?
	if( isEmpty( accounts ) ) {
		// This is an error.
		log.message.error( "No acounts set up. Please add at least one account." );
		// Exit
		process.exit( 1 );
	}

	module.exports = accounts;
}
catch( e ) {
	log.message.error( "Error creating accounts.", e );
}
