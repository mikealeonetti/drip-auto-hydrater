//jshint esversion:9
//jshint node:true
/**
 * The program logger
 */
const config = require( './config' );

const debug = require( "debug" )( "lib:logger" );

// Our custom config
const c = { ...config.log };

// We use the console on debug
c.useConsole = config.debug;
c.path = config.path.log;

// Turn off exceptionLog during debug
if( config.debug )
	c.exceptionLog = null;

debug( "Log options", c );

// Get our logger
module.exports = require( './logger-defaults' )( c );
