//jshint esversion:9
//jshint node:true

const config = require( '../lib/config' );
const log = require( '../lib/logger' );
const { timeout } = require( './util' );
const { isEmpty, isArray, toLower, first } = require( 'lodash' );
const setHours = require( 'date-fns/setHours' );
const setMinutes = require( 'date-fns/setMinutes' );
const setMilliseconds = require( 'date-fns/setMilliseconds' );
const setSeconds = require( 'date-fns/setSeconds' );
const addDays = require( 'date-fns/addDays' );

/**
 * Our main schedule module.
 * This is meant to fire off the events.
 */
class Scheduler {
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
	 * Convert times string/array
	 */
	static parseTimes( times ) {
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
				h = Scheduler.amOrPMHour( h, m[ 3 ] );

				// Grab the minutes
				const m = 60 * ( h%1 );

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
				h = Scheduler.amOrPMHour( h, m[ 5 ] );

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
	 * Execute an account task
	 */
	async executeAccount( accountName, details ) {
		debug( "Executed %s with details", accountName, details );
	}

	/**
	 * Kick off a running
	 */
	async run() {
		// Are we already runnign?
		if( this.running )
			throw new Error( "Cannot double run." );

		// We are now running
		this.running = true;

		try {
			// now
			const now = new Date();

			// Give us a way to break out.
			// Not sure if we'll ever use it.
			while( this.running ) {
				// We are going to run every minute
				// Get the next distance to a minute plus 1 second
				const nextMinutePlusOneSecond = ( 60000 - +now % 60000 ) + 1000;

				// Now wait until then
				await timeout( nextMinutePlusOneSecond );

				// Check the next run date
				let nextRun = config.get( "schedule.nextRun" );

				// Is it time?
				if( nextRun==null || new Date()>=new Date( nextRun ) ) { // It's time!
					// Set the next run
					let times = config.get( "schedule.times" );

					// Parse the times array
					times = Scheduler.parseTimes( times );

					// We need at least one run time
					if( isEmpty( times ) )
						throw new Error( "There are no specified run times." );


					debug( "times=", times );

					// Get the next time to fire
					nextRun = Scheduler.getNextTime( times, now );

					// This should not be!
					if( !nextRun )
						throw new Error( "There is no next time!" );

					// Save it
					config.put( {
						'schedule' : { nextRun }
					} );

					// Run each
					const accounts = config.get( "accounts" );
					
					// No accounts?
					if( isEmpty( accounts ) ) {
						// There were no accounts?
						log.message.warn( "No accounts found to run." );
						// Go again
						continue;
					}

					// Execute each
					for( const accountName in accounts ) {
						// Now execute this task
						await this.executeAccount( accountName, accounts[ accountName ] );
					}
				}
			}
		}
		catch( e ) {
			// We had a fatal error
			log.message.error( "Scheduler broke on run error.", e );
		}
	}
}


// Export it
module.exports = Schedules;
