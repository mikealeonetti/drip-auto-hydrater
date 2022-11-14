//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const { toLower, first, isEmpty, map, isArray, size } = require( 'lodash' );

const BigNumber = require( 'bignumber.js' );

const setHours = require( 'date-fns/setHours' );
const setMinutes = require( 'date-fns/setMinutes' );
const setMilliseconds = require( 'date-fns/setMilliseconds' );
const setSeconds = require( 'date-fns/setSeconds' );
const addDays = require( 'date-fns/addDays' );
const log = require( '../lib/logger' );
const { PropertiesNextActionKey, PropertiesNextRunKey } = require( './constants' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "inc:accounts" );
const fs = require( 'fs' );
const crypt = require( './crypt' );
const path = require( 'path' );
const faucet = require( './faucet' );
const bsc = require( './bsc' );
const tg = require( './telegram' );
const Web3 = require("web3");

/**
 * Accounts class
 */
module.exports = class Account {
	/**
	 * C-tor
	 */
	constructor( account ) {
		// Make sure we have all of the info
		const {
			key,
			actions,
			id,
			enabled,
			keyFile
		} = account;

		// Do we have these?
		if( isEmpty( key ) )
			throw new Error( "No account key." );

		// Need actions
		if( !isArray( actions ) || isEmpty( actions ) )
			throw new Error( `Please specify actions for the account ${key}.` );

		// Save them
		this.key = key;
		this.actions = actions;
		this.id = id;
		this.enabled = enabled==null ? true : enabled;

		// Get the private key path
		this.privateKeyPath = path.join( config.path.privateKeys, keyFile||key );

		// Test to see if it exists
		try {
			// Try and access it before we run
			fs.accessSync( this.privateKeyPath );
		}
		catch( e ) {
			log.message.error( "Error trying to access key file %s.", this.privateKeyPath );
		}

		// Shorthand and save our key
		this.NextActionKey = PropertiesNextActionKey+key;
		this.PropertiesNextRunKey = PropertiesNextRunKey+key;
	}

	/**
	 * Get the gas balance in BigNumber
	 */
	async getGasBalance() {
				// Get the gas balance
				let gasBalance = await bsc.eth.getBalance( this.id );

				// Unwei it
				gasBalance = Web3.utils.fromWei( gasBalance );

				debug( "gasBalance 1=%s", gasBalance );

				gasBalance = BigNumber( gasBalance );;

				// To BigNumber
				debug( "gasBalance 2=%s", gasBalance );

				// Return it
				return( gasBalance );
	}

	/**
	 * Execute the transaction
	 */
	async executeTxn( type, txn, pk, module, extras ) {
		debug( "txn=", txn, "extras=", extras );

		// Get the gas
		let gas = await txn.estimateGas( { ...extras, 'from' : this.id } );

		// Allow for more gas expenses
		gas = Math.round( gas*1.3 );

		debug( "gas=", gas );

		// Encode the abi data
		const data = txn.encodeABI();

		// The opts
		const opts = {
			...extras,
			'to' : module.options.address,
			gas,
			data
		};

		debug( "data=", data, "opts=", opts );

		// Now do the txn
		const signedTxn = await bsc.eth.accounts.signTransaction( opts, pk );

		// About to log it
		log.message.info( "About to execute [%s] on [%s] with %d gas.", type, this.key, gas );

		debug( "signedTxn=", signedTxn );

		// Now send it!
		const receipt = await bsc.eth.sendSignedTransaction( signedTxn.rawTransaction );

		debug( "receipt=", receipt );

		// receipt.status==true/false, receipt.transactionHash

		if( !receipt.status ) {
			log.message.error( "Transaction error", receipt );

			throw new Error( "Transaction error" );
		}

		// Get the gas amount
		const remainingGas = await this.getGas();
		let { gasUsed } = receipt;
		//const usedGas = bsc.utils.fromWei( String( receiptcumulativeGasUsed ) );
		// Get the gas price
		let gasPrice = await bsc.eth.getGasPrice();

		// Convert from wei
		gasPrice = bsc.utils.fromWei( String( gasPrice ) );

		// Set the used
		gasUsed*= gasPrice;

		// Inform
		await tg.sendMessage( `${type} succeeded on account '${this.key}'.\n\nCost=${gasUsed} BNB\nRemaining gas=${remainingGas} BNB\nTXN Hash=${receipt.transactionHash}` );

		// Send itt back
		return( receipt );
	}

	/**
	 * Set an hour based on AM or PM
	 */
	static amOrPMHour( h, aorp ) {
		// Am or PM?
		if( aorp ) {
			// It's PM?
			if( toLower( aorp )=="p" )
				h+= 12; // Add 12
			else if( h==12 ) // 12 AM is really 0
				h = 0;
		}

		// Make sure we're not over
		if( h>24 )
			h = 0; // Bring back

		// Return the h
		return( h );
	}

	/**
	 * Convert times string/array
	 */
	static parseTimes( times, now=new Date() ) {
		// Nuffin
		if( isEmpty( times ) )
			return( times ); // Whoops

		// Is it an array?
		if( !isArray( times ) )
			times = [ times ]; // Coerce it to be one

		// Now convert to actual times
		times = times.reduce( ( times, time )=>{
			// Use regexp to pull what we need
			let m, t;

			// Do we have a decimal format
			if( (m = time.match( /^([\d\.]+)(\s*(a|p)m?)?$/i )) ) {
				// Get the hours
				let h = parseFloat( m[ 1 ] ); // Make sure it's a float

				// Set based on AM or PM
				h = Account.amOrPMHour( h, m[ 3 ] );

				// Grab the minutes
				m = 60 * ( h%1 );

				// Remove the decimal
				h = Math.floor( h );

				// Set our time based on the hours
				t = setHours( now, h );
				t = setMinutes( t, m );
			}
			else if( (m = time.match( /^(\d+)(:(\d+))?(\s*(a|p)m?)?$/i )) ) {
				// Build the time
				let h = parseInt( m[ 1 ] );

				// Set based on AM or PM
				h = Account.amOrPMHour( h, m[ 5 ] );

				// Now the minutes
				m = parseInt( m[ 3 ] )||0;

				// Now set
				t = setHours( now, h );
				t = setMinutes( t, m );
			}
			else
				return( times ); // Short circuit, don't add

			// Clear these guys
			t = setSeconds( t, 0 );
			t = setMilliseconds( t, 0 );

			// Add today
			times.push( t );

			// Add tomorrow
			times.push( addDays( t, 1 ) );

			// Return it
			return( times );
		}, [] )
		// Make sure they are in the right order
		.sort();

		// Give it back
		return( times );
	}

	/**
	 * Get the next run time
	 */
	async getNextRun( now=new Date() ) {
		// Do we have one already in the database?
		const property = await db.Property.findOne( { 'where' : { 'key' : this.PropertiesNextRunKey } } );

		// Our next run
		let nextRun;

		// Convert to a time
		if( property?.value )
			nextRun = new Date( parseInt( property.value ) );

		// Do we not have a next run?
		if( !nextRun ) {
			// Set it
			nextRun = await this.setNextRun( now );
		}

		// Return it
		return( nextRun );
	}

	/**
	 * Get the next closest time to now
	 */
	static getNextTime( times, now=new Date() ) {
		// Filter out all times less than now
		times = times.filter( t=>t>now );

		// Now get the first
		const t = first( times );

		// REturn it
		return( t );
	}

	/**
	 * Execute the next task
	 */
	async execute() {
		try {
			// Get the next action index from the database
			let property = await db.Property.findOne( { 'where' : { 'key' : this.NextActionKey } } );

			// Do we have a last property?
			let nextActionIndex = parseInt( property?.value )||0;

			// Did we exceed the index?
			if( nextActionIndex>=size( this.actions ) )
				nextActionIndex = 0; // Loop it around

			// Get the action
			const action = this.actions[ nextActionIndex ];

			// Get the private key for the account
			let pk = await fs.promises.readFile( this.privateKeyPath ); 

			// Now decrypt it
			pk = crypt.decrypt( pk, config.crypt.key );

			debug( "pk=", pk );

			// Call up
			debug( "Calling up." );
			await this._execute( pk, action );

			// Increment
			if( !property )
				property = db.Property.build( { 'key' : this.NextActionKey } );

			// Set the next
			property.value = nextActionIndex+1;

			debug( "New property", property );
			
			// Save it
			await property.save();
		}
		catch( e ) {
			log.message.error( "Execution failed on account %s.", this.key, e );

			try {
				// Report error to TG
				tg.sendMessage( `Failed to execute on account ${this.key}: ${e.message||e}.` );
			}
			catch( e2 ) {
				log.message.error( "Error [%s] reporting to instagram.", this.key, e2 );
			}
		}
	}

	/**
	 * Set the next run time in the database
	 */
	async setNextRun( now=new Date() ) {
		// Set the next run
		let times = config.schedule.times;

		// Parse the times array
		times = Account.parseTimes( times, now );

		// Rule out all expired times
		times = times.filter( time=>time>now );

		// We need at least one run time
		if( isEmpty( times ) )
			throw new Error( "There are no specified run times." );

		debug( "times=", times );

		// Get the next time to fire
		let nextRun = Account.getNextTime( times, now );

		// Do we have a callback modifier?
		if( this._nextRun instanceof Function )
			nextRun = await this._nextRun( nextRun );

		// This should not be!
		if( !nextRun )
			throw new Error( "There is no next time!" );

		// Save it
		db.Property.upsert( { 'key' : this.PropertiesNextRunKey, 'value' : +nextRun } );

		// Return it
		return( nextRun );
	}

	/**
	 * Get the amount of gas
	 */
	async getGas() {
		// Get as gas
		let gas = await bsc.eth.getBalance( this.id );

		// Now convert to actual gas from wei
		gas = bsc.utils.fromWei( gas );

		// Return it
		return( gas );
	}

};
