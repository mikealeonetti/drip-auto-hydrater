//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const log = require( '../lib/logger' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "drivers:arkfi" );
const arkfi = require( '../inc/arkfi' );
const tg = require( '../inc/telegram' );


const Account = require( '../inc/account' );

/**
 * Our driver class subclasses the main account class
 */
module.exports = class ArkFiAccount extends Account {
	/**
	 * Execute a ckaun
	 */
	async takeAction( split, pk ) {
		log.message.info( "Taking an arkfi action %s", this.key );

		// Make sure each action is AT LEAST 0
		for( let i=0; i<3; ++i )
			split[ i ] = Math.max( 0, parseInt( split[ i ] ) )||0;

		
		debug( "split is", split );

		// Split the actions
		const [ compound, withdraw, airdrop ] = split;

		// Total the percent
		const totalPercent = withdraw+compound+airdrop;

		// Make sure they all add up to 100
		if( totalPercent!=100 ) {
			log.message.error( "cwa does not equal 100% but %d%", totalPercent, this.key );
			return;
		}

		tg.sendMessage( `${this.key} cwa execution ${compound}/${withdraw}/${airdrop}.` );
	
		// Create a tx
		// withdraw/compound/airdrop
		const txn = arkfi.methods.takeAction( withdraw, compound, airdrop, false, false, false );

		// Execute it
		await this.executeTxn( "takeAction", txn, pk, arkfi );
	}

	/**
	 * Execute the next task
	 */
	async _execute( pk, action ) {
		debug( "Action='%s'", action );

		try {
			// Test the action
			if( /^[\/0-9]+$/.test( action ) ) {
				// Execute it
				await this.takeAction( action.split( "/" ), pk );
			}
			else {
					// Don't know this action so likely a noop
					tg.sendMessage( `${this.key} executed a NoOp.` );
					log.message.info( "Executing a NoOp on account %s", this.key );
			}
		}
		catch( e ) {
			log.message.error( "Execution failed on account %s.", e );
		}
	}
};
