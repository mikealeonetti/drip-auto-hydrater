//jshint esversion:11
//jshint node:true
/**
 * The program logger
 */
const winston = require( 'winston' );
const path = require( 'path' );
//const printable = require( './printable' );
const { format } = require( 'logform' );
//const { forEachObject } = require( './util' );
const _ = require( 'lodash' );

const util = require( 'util' );

const debug = require( "debug" )( "logger-defaults:index" );

const formatRegExp = /%[scdjifoO%]/g;

const splatSymbol = Symbol.for( "splat" );
const tagSymbol = Symbol.for( "tag" );

/**
 * Our format function
 */
function formatFn( isFile ) {
	/*
	return( format.combine(
		format.errors( { 'stack' : true } ),
		format.metadata(),
		format.splat(),
		format.printf( info=>`${new Date().toString()} ${info.level}: ${info.message}` )
	) );
	*/

	return( 
		format.printf( info=>{

		debug( "Winston extras", info );

		// Take out the ones we are going to print plain text
		const extras = info[ splatSymbol ];

		// Grab out the message
		let { message } = info;
		let tag;

		// Is the extras an actual array?
		if( extras instanceof Array && extras.length>0 ) {
			// Do we have any tags?
			for( let i=0, { length }=extras; i<length; ++i ) {
				const t = extras[ i ]?.[ tagSymbol ];

				if( t ) {
					// Set it
					tag = t;
					// Remove it
					extras.splice( i, 1 );
					// Stop here
					break;
				}
			}

			// How many formats do we have
			const tokens = message && message.match && message.match( formatRegExp );

			// The token length
			const tokenLength = tokens&&tokens.length||0;

			debug( "We have %s tokens", tokenLength );

			// Get a count of the amount of splats
			if( tokenLength ) {
				const a = extras.splice( 0, tokenLength );

				debug( "Using tokens", a );

				message = util.format( message, ...a );
			}
		}

		//debug( "Message is", message );

		//return( util.format( "%s %s: %s %o", `${new Date().toString()} ${info.level}: ${message} ${printable.field( extras, true )}` );
		
		// Out format
		let format = "%s: <%s>"; // Date and level

		// The date
		const date = new Date().toLocaleString( 'en-US', {
        'timeZone' : 'America/New_York'
    } );

		const fields = [ date, info.level ];

		// Tag?
		if( tag ) {
			format+= " [%s]";
			fields.push( tag );
		}

		// Add the message
		format+= " %s";
		fields.push( message );
		
		// Add the message
		if( extras && Object.keys( extras ).length>0 ) {
			format+= " %s";
			fields.push( ...extras );
		}

		return( util.format( format, ...fields ) );

		/*
			return( util.format( "%s %s: %s %o", new Date(), info.level, message, extras ) );
		else
			return( util.format( "%s %s: %s", new Date(), info.level, message ) );
		*/
	} ) );
}

/**
 * Log creating function
 */
module.exports = function( config ) {

	/**
	 * Multiple log class
	 */
	class MultiLog {
		/**
		 * C-tor
		 */
		constructor( logs ) {
			//debug( "Got multilog logs", logs );

			// Save the logs
			this.logs = logs;
		}
	}

	// Our log holder
	// We're going to return this
	function multilogWrap( object ) {
		return( _.merge( function( ...logs ) {
			//debug( "We got our function.", logs );

			return( new MultiLog( logs.map( l=>object[ l ] ) ) );
		}, object ) );
	}

	// Our objec
	const that = {};

	// A tagged logger
	that.createTagged = function( tag ) {
		// Clone us
		const ourThat = _.clone( that );

		// Now modify just our loggers to allow tags
		_.each( ourThat, ( logger, key )=>{
			// Make sure it's a logger
			if( !logger.isLogger )
				return( debug( "Logger is  not a logger", logger ) );

			debug( "About to wrap logger", logger );

			// Do the logger
			ourThat[ key ] =

			// For each
			_.reduce( winston.config.npm.levels, ( ourLogger, value, level )=>{
				// Add a prototype
				ourLogger[ level ] = function( ...args ) {
					// Call the upper level
					return( logger[ level ]( ...args, { [ tagSymbol ] : tag } ) );
				};

				// Do this
				return( ourLogger );
			}, {} );

		// End it
		} );

		// Return our new logger
		return( multilogWrap( ourThat ) );
	};

	// For each
	_.each( winston.config.npm.levels, ( value, level )=>{
		debug( "Adding level prototype", level );

		// Add a prototype
		MultiLog.prototype[ level ] = function( ...args ) {
			// Loop through each
			for( const log of this.logs )
				log[ level ]( ...args ); // Call
		};
	} );

	// The basic file options
	const sharedFileOptions = _.pick( config, "maxFiles", "maxsize", "level" );

	function getTransports( name, transports=[] ) {
		debug( "Getting transnports for name", name );

		// Make our options
		const fileOptions = { 
			'filename' : config.path ? path.join( config.path, name ) : name,
			...sharedFileOptions
		};

		transports.push(
			new winston.transports.File( fileOptions )
		);

		if( config.useConsole ) {
			transports.push( new winston.transports.Console( {
				'level' : config.level
			} ) );
		}

		// Do we have a callback?
		if( config.onTransportCreate instanceof Function )
			config.onTransportCreate( transports );

		return( transports );
	}

	// If we are not debugging, then have winston handle the exceptions
	if( config.exceptionLog ) {
	// Hold off on this
	// new winston.transports.Console()
	// Our exception handler
		winston.exceptions.handle( getTransports( config.exceptionLog, config.exceptionTransports ) );
		winston.exitOnError = false;
	}

	// This seeems somehow more efficient
	for( const [ log, file ] of Object.entries( config.logs ) ) {
		debug( "Creating log [%s] with file [%s].", log, file );

		// The logger options
		const opts = {
			'transports' : getTransports( file )
		};

		// The request is different
		if( config.simpleLogs instanceof Array && config.simpleLogs.indexOf( log )!=-1 ) {
			debug( "Log [%s] is a simple log." );
			opts.format = format.printf( ( { message } )=>message ); // Just print verbatim. We really just want the log rotation functions
		}
		else
			opts.format = formatFn( false );
		
		// Now set the watch
		const logger =  winston.createLogger( opts );

		/*
		// A tagged logger
		logger.Tagged = function( tag ) {
			this.tag = tag;
		};
		
		// For each
		_.each( winston.config.npm.levels, ( value, level )=>{
			// Add a prototype
			logger.Tagged.prototype[ level ] = function( ...args ) {
				// Call the upper level
				logger[ level ]( ...args, { [ tagSymbol ] : this.tag } );
			};
		} );
		*/

		// Add the slack transport
		//logger.add( SlackTransport );

		const ourLogger = that[ log ] = logger;

		// This is a logger
		ourLogger.isLogger = true;

		//logger.info( "Starting", { 'test' : true }, new Error( "Helo" ), [ 1, 2, 3, 4 ] );
	} // End for loop

	// Do we have additional logs?
	if( _.size( config.additionalLogs ) ) {
		// Loop each
		_.each( config.additionalLogs, ( opts, name )=>{
			// Merge the opts with the default
			opts = {
				'transports' : getTransports( name ),
				'format' : formatFn( false ),
				...opts
			};

			debug( "Creating additional log [%s] with opts", name, opts );

			// Create it
			const ourLogger = that[ name ] = winston.createLogger( opts );

			// This is also al ogger
			ourLogger.isLogger = true;
		} );
	}

	// Return that
	return( multilogWrap( that ) );
};

