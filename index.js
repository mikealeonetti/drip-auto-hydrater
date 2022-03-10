#!/usr/bin/env node
//jshint esversion:9
//jshint node:true

//const Web3 = require( 'web3' );

//const { FAUCET_ABI, FAUCET_ADDR } = require( './drip-config' );

//const web3_bsc = new Web3( 'https://bsc-dataseed1.binance.org:443' );

//const faucet = new web3_bsc.eth.Contract( FAUCET_ABI, FAUCET_ADDR );

const Scheduler = require( './inc/scheduler' );
const log = require( './lib/logger' );
const debug = require( 'debug' )( "index" );
const fs = require( 'fs' );

// Spit out a quick log
log.message.info( "Starting..." );

// Create the directories that we need to function
for( const path of [
	config.path.log
	] ) {
	try {
		debug( "Trying to create directory %s.", path );

		// Create recursively
		fs.mkdirSync( path, { 'recursive' : true } );
	}
	catch( e ) {
		if( e.code!="EEXIST" ) {
			console.error( e );
			process.exit( 1 );
		}
	}
}

// Run the scheduler
new Scheduler().run();
