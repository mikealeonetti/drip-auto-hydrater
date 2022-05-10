//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const log = require( '../lib/logger' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "drivers:stampede" );
const stampede = require( '../inc/stampede' );
const tg = require( '../inc/telegram' );


const Account = require( '../inc/account' );

/**
 * Our driver class subclasses the main account class
 */
module.exports = class StampedeAccount extends Account {
	/**
	 * Execute a ckaun
	 */
	async executeClaim( pk ) {
		log.message.info( "Executing a claim on account %s", this.key );
	
		// Create a tx
		const txn = stampede.methods.claim();

		// Execute it
		await this.executeTxn( "claim", txn, pk, stampede );
	}

	/**
	 * Execute a roll
	 */
	async executeRoll( pk ) {
		log.message.info( "Executing a roll on account %s", this.key );

		// Create a tx
		const txn = stampede.methods.roll();

		// Execute it
		await this.executeTxn( "roll", txn, pk, stampede );
	}

	/**
	 * Execute the next task
	 */
	async _execute( pk, action ) {
		debug( "Action='%s'", action );

		try {
			// Parse the action
			switch( action ) {
				case "roll":
					await this.executeRoll( pk );
					break;
				case "claim":
					await this.executeClaim( pk );
					break;
				default:
					log.message.warn( "Unknown Stampede action %s for account %s", action, this.key );
				case "noop":
					tg.sendMessage( `${this.key} executed a NoOp.` );
					log.message.info( "Executing a NoOp on account %s", this.key );
			}
		}
		catch( e ) {
			log.message.error( "Execution failed on account %s.", e );
		}
	}
};
