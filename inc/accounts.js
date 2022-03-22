//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const { isEmpty, map, isArray, size } = require( 'lodash' );

const log = require( '../lib/logger' );

const FaucetAccount = require( '../drivers/faucet' );
const GardenAccount = require( '../drivers/garden' );

// Do in a look in cast there is an error on this
try {
	// Create accounts for everybody
	const accounts = map( config.accounts, account=>{
		// The class we use
		let C;

		// This can be done with an array FYI

		// Based on the driver
		switch( account.driver ) {
			case "faucet":
				C = FaucetAccount;
				break;
			case "garden":
				C = GardenAccount;
				break;
			default:
				log.message.error( "Account [%s] has unrecognized driver '%s'.", account.key, account.driver );
				process.exit( 1 );
		}

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
