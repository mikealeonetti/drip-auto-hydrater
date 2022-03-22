#!/usr/bin/env node
//jshint esversion:9
//jshint node:true

const config = require( '../lib/config' );
const crypt = require( '../inc/crypt' );
const fs = require( 'fs' );
const path = require( 'path' );
//const { toLower } = require( 'lodash' );
const readline = require( 'readline' ).createInterface( {
	'input' : process.stdin,
	'output' : process.stdout
} );

// The drivers we'll take
const AcceptedDrivers = [ "faucet", "garden" ];

// Make the question promisey
const question = query=>new Promise( resolve => readline.question( query, resolve ) );

// Spit out a quick log
console.info( "Executing account creator..." );

// Now run this
(async function() {
	try {
		// Read the config file
		let localConfig = await fs.promises.readFile( config.path.localConfigFile );

		// From JSON
		localConfig = JSON.parse( localConfig );

		// Get the account name
		let accountName = await question( "Account name: " );
		// The driver
		let accountDriver = await question( `Driver [one of "garden" or "faucet"]: ` );
		// The wallet ID
		let walletID = await question( "Wallet ID: " );
		// Comma seaparated actions
		let actions = await question( "Actions (comma between each): " );
		// Now the key
		let accountKey = await question( "Private key: " );

		// Clean up everything
		accountName = accountName.trim().toLowerCase().replace( /\W/g, "" );
		accountDriver = accountDriver.trim().toLowerCase();
		accountKey = accountKey.trim();
		walletID = walletID.trim();
		actions = actions.toLowerCase().split( "," ).map( a=>a.trim() );

		// Loop and make sure we have all
		for( const [ variable, name ] of [ [ accountName, "account name" ],
			[ accountDriver, "account driver" ],
			[ accountKey, "account key" ] ] ) {
			// Check each
			if( !variable )
				throw new Error( `Please enter a valid ${name}.` );
		}

		// Make sure we have a correct driver
		if( AcceptedDrivers.indexOf( accountDriver )==-1 )
			throw new Error( "Driver not valid." );

		// Encrypt the private key
		accountKey = await crypt.encrypt( accountKey, config.crypt.key );

		// Save it
		await fs.promises.writeFile( path.join( config.path.privateKeys, walletID ), accountKey );

		// Create our new object
		const o = {
			'keyFile' : walletID,
			'key' : accountName,
			'driver' : accountDriver,
			actions,
			'id' : walletID,
		};

		// Do we have this already?
		let found=false;

		// Replace the account if we have
		localConfig.accounts = localConfig.accounts.map( a=>{
			// Have it?
			if( a.key==accountName ) {
				// We found it
				found = true;
				// Save it
				a = o;
			}

			// return it
			return( a );
		} );

		// No account? Add
		if( !found )
			localConfig.accounts.push( o );

		// JSON it
		const json = JSON.stringify( localConfig, null, 2 );

		// Write the new file
		await fs.promises.writeFile( config.path.localConfigFile, json );

		// We're done
		process.exit( 0 );
	}
	catch( e ) {
		// Log
		console.error( e );

		// Exit
		process.exit( 1 );
	}
} )();
