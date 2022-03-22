//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const log = require( '../lib/logger' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "drivers:faucet" );
const faucet = require( '../inc/faucet' );
const tg = require( '../inc/telegram' );


const Account = require( '../inc/account' );


/**
 * Our driver class subclasses the main account class
 */
module.exports = class FaucetAccount extends Account {
	/**
	 * Execute a hydrate
	 */
	async executeHydrate( pk ) {
		log.message.info( "Executing a hydrate on account %s", this.key );
	
		// Create a tx
		const txn = faucet.methods.roll();

		// Execute it
		await this.executeTxn( "hydrate", txn, pk );
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
	async _execute( pk, action ) {
		debug( "action='%s'", action );

		try {
			// Parse the action
			switch( action ) {
				case "hydrate":
					await this.executeHydrate( pk );
					break;
				case "claim":
					await this.executeClaim( pk );
					break;
				default:
					log.message.warn( "Unknown Faucet action %s for account %s", action, this.key );
				case "noop":
					tg.sendMessage( `${this.key} executed a NoOp.` );
					log.message.info( "Executing a NoOp on account %s", this.key );
			}
		}
		catch( e ) {
			log.message.error( "Execution failed on account %s.", e );
		}
	}
}
