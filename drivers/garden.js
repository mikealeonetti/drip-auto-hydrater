//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const log = require( '../lib/logger' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "drivers:garden" );
const garden = require( '../inc/garden' );
const tg = require( '../inc/telegram' );


const Account = require( '../inc/account' );

const SeedsPerPlant = 2592000;

/**
 * Our driver class subclasses the main account class
 */
module.exports = class GardenAccount extends Account {
	/**
	 * the next time setter. Calculates when the next plant is closest to the requestd time.
	 */
	async _nextRun( time ) {
		// We'll need to get the plants and the seeds
		let [ plants, seeds ] = await Promise.all( [
									garden.methods.hatcheryPlants( this.id ).call(),
									garden.methods.getSeedsSinceLastPlant( this.id ).call()
								] );

		// Must be int
		plants = parseInt( plants );
		
		debug( "plants=", plants );

		//  Must be int also
		seeds = parseInt( seeds );

		debug( "seeds=", seeds );

		//const secondsAway = (2592000 - (seeds % 2592000) ) / plants;

		//console.log( "Seconds away is", secondsAway );
		//
		debug( "time=", time );
		
		// Get our now
		const now = new Date();

		//console.log( new Date( Date.now()+secondsAway*1000 ).toLocaleString() );
		// How many seeds will we have by the next date?
		let secondsAway = Math.floor( ( time - now ) / 1000 );

		debug( "secondsAway=", secondsAway );

		// Now see how many plants we will grow in that time?
		let plantsWeGrowUntilThen = ( seeds + secondsAway * plants ) / SeedsPerPlant;

		debug( "plantsWeGrowUntilThen=", plantsWeGrowUntilThen );

		// Is it a whole number
		const isWholeNumber = plantsWeGrowUntilThen % 1 == 0;

		debug( "isWholeNumber=", isWholeNumber );

		// If it's not a whole number
		if( !isWholeNumber ) {
			// Add one
			plantsWeGrowUntilThen = Math.floor( plantsWeGrowUntilThen ) + 1;

			debug( "plantsWeGrowUntilThen 2=", plantsWeGrowUntilThen );

			// Now turn back into seconds
			secondsAway = ( ( plantsWeGrowUntilThen * SeedsPerPlant ) - seeds ) / plants;

			debug( "secondsAway 2=", secondsAway );

			// Set the time
			time = new Date( +now + ( (secondsAway+60) * 1000 )  );
		}

		debug( "time=", time );

		// Time
		return( time );
	}

	/**
	 * Execute a ckaun
	 */
	async executeClaim( pk ) {
		log.message.info( "Executing a claim on account %s", this.key );
	
		// Create a tx
		const txn = garden.methods.claimSeeds();

		// Execute it
		await this.executeTxn( "claim", txn, pk, garden );
	}

	/**
	 * Execute a plant
	 */
	async executePlant( pk ) {
		log.message.info( "Executing a plant on account %s", this.key );

		// Grab the referral for some reason
		const referral = await garden.methods.referrals( this.id ).call();
	
		// Create a tx
		const txn = garden.methods.plantSeeds( referral );

		// Execute it
		await this.executeTxn( "plant", txn, pk, garden );
	}

	/**
	 * Execute the next task
	 */
	async _execute( pk, action ) {
		debug( "Action='%s'", action );

		try {
			// Parse the action
			switch( action ) {
				case "plant":
					await this.executePlant( pk );
					break;
				case "claim":
					await this.executeClaim( pk );
					break;
				default:
					log.message.warn( "Unknown Garden action %s for account %s", action, this.key );
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
