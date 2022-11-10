//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const log = require( '../lib/logger' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "drivers:furio" );
const furio = require( '../inc/furio' );
const tg = require( '../inc/telegram' );


const Account = require( '../inc/account' );

/**
 * Our driver class subclasses the main account class
 */
module.exports = class FurioAccount extends Account {
	/**
	 * Execute a ckaun
	 */
	async executeClaim( pk ) {
		log.message.info( "Executing a claim on account %s", this.key );
	
		// Create a tx
		const txn = furio.methods.claim();

		// Execute it
		await this.executeTxn( "claim", txn, pk, furio );
	}

	/**
	 * Execute a roll
	 */
	async executeCompound( pk ) {
		log.message.info( "Executing a compound on account %s", this.key );

		// Create a tx
		const txn = furio.methods.compound();

		// Execute it
		await this.executeTxn( "compound", txn, pk, furio );
	}

	/**
	 * Execute the next task
	 */
	async _execute( pk, action ) {
		debug( "Action='%s'", action );

		try {
			// Parse the action
			switch( action ) {
				case "compound":
					await this.executeCompound( pk );
					break;
				case "claim":
					await this.executeClaim( pk );
					break;
				default:
					log.message.warn( "Unknown Furio action %s for account %s", action, this.key );
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
