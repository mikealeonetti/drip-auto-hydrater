//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const { isEmpty, map, isArray, size } = require( 'lodash' );

const log = require( '../lib/logger' );
const { PropertiesNextActionKey } = require( './constants' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "inc:accounts" );
const fs = require( 'fs' );
const crypt = require( './crypt' );
const path = require( 'path' );
const faucet = require( './faucet' );
const bsc = require( './bsc' );
const tg = require( './telegram' );

/**
 * Accounts class
 */
class Account {
	/**
	 * C-tor
	 */
	constructor( account ) {
		// Make sure we have all of the info
		const {
			key,
			actions,
			id
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

		// Get the private key path
		this.privateKeyPath = path.join( config.path.privateKeys, key );

		// Shorthand and save our key
		this.NextActionKey = PropertiesNextActionKey+key;
	}

	/**
	 * Execute a hydrate
	 */
	async executeHydrate( pk ) {
		log.message.info( "Executing a hydrate on account %s", this.key );
	
		// Create a tx
		const txn = faucet.methods.roll();

		// Execute it
		await this.executeTxn( "hydrate", txn, pk );

		process.exit( 0 );
	}

	/**
	 * Execute the transaction
	 */
	async executeTxn( type, txn, pk ) {
		debug( "txn=", txn );

		// Get the gas
		const gas = await txn.estimateGas( { 'from' : this.id } );

		debug( "gas=", gas );

		// Encode the abi data
		const data = txn.encodeABI();

		debug( "data=", data );

		// Now do the txn
		const signedTxn = await bsc.eth.accounts.signTransaction( {
			'to' : faucet.options.address,
			gas,
			data
		}, pk );

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
		const usedGas = bsc.utils.fromWei( String( receipt.cumulativeGasUsed ) );

		// Inform
		await tg.sendMessage( `${type} succeeded on account '${this.key}'.\n\nCost=${usedGas} BNB\nRemaining gas=${remainingGas} BNB\nTXN Hash=${receipt.transactionHash}` );

		// Send itt back
		return( receipt );
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

	/**
	 * Execute a claim
	 */
	async executeClaim( pk ) {
		log.message.info( "Executing a claim on account %s", this.key );
	
		// Create a tx
		const txn = faucet.methods.claim();

		// Execute it
		await this.executeTxn( "claim", txn, pk );
	}

	/**
	 * Execute the next task
	 */
	async execute() {
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

		// Parse the action
		switch( action ) {
			case "hydrate":
				await this.executeHydrate( pk );
				break;
			case "claim":
				await this.executeClaim( pk );
				break;
			default:
				log.message.warn( "Unknown action %s for account %s", action, this.key );
			case "noop":
				log.message.info( "Executing a NoOp on account %s", this.key );
		}

		// Increment
		if( !property )
			property = db.Property.build( { 'key' : this.NextActionKey } );

		// Set the next
		property.value = nextActionIndex+1;

		debug( "New property", property );
		
		// Save it
		await property.save();
	}
}

// Do in a look in cast there is an error on this
try {
	// Create accounts for everybody
	const accounts = map( config.accounts, account=>new Account( account ) );

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
