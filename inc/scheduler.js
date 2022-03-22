//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );
const log = require( '../lib/logger' );
const { timeout } = require( './util' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "inc:scheduler" );
const accounts = require( './accounts' );
const tg = require( './telegram' );

/**
 * Our main schedule module.
 * This is meant to fire off the events.
 */
class Scheduler {

	/**
	 * Kick off a running
	 */
	async run() {
		// Are we already runnign?
		if( this.running )
			throw new Error( "Cannot double run." );

		// We are now running
		this.running = true;

		// Did we notify about the next runtime?
		const notifiedAboutNextRun = {};

		try {
			// We are now running
			tg.sendMessage( "Hydrater started." );

			// Give us a way to break out.
			// Not sure if we'll ever use it.
			while( this.running ) {
				// now
				let now = new Date();

				// We are going to run every minute
				// Get the next distance to a minute plus 1 second
				const nextMinutePlusOneSecond = ( 60000 - +now % 60000 ) + 1000;

				debug( "nextMinutePlusOneSecond=", nextMinutePlusOneSecond );

				// Now wait until then
				await timeout( nextMinutePlusOneSecond );
				//await timeout( 1000 );

				debug( "Broke timeout" );

				// Get now again
				now = new Date();

				// Loop each and map
				const p = accounts.map( async account=>{
					// Get the next run
					const nextRun = await account.getNextRun();

					// Alert the user when we're going to run again
					if( !notifiedAboutNextRun[ account.key ] ) {
						// Send through TG
						tg.sendMessage( `We are going to run ${account.key} again on ${nextRun}.` );
						log.message.info( `We are going to run ${account.key} again on ${nextRun}.` );
						// Dont' keep notifying
						notifiedAboutNextRun[ account.key ] = true;
					}

					// Is it time?
					if( now>=nextRun ) { // It's time!
						// Perform an execution
						await account.execute();

						// Set the next run
						await account.setNextRun();

						// Set to notify again
						notifiedAboutNextRun[ account.key ] = false;
					}
				} );

				// Wait for them all
				await Promise.all( p );

			}
		}
		catch( e ) {
			// We had a fatal error
			log.message.error( "Scheduler broke on run error.", e );
		}
	}
}


// Export it
module.exports = Scheduler;
