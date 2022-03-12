//jshint esversion:11
//jshint node:true
const config = require( '../lib/config' );

const { Telegraf } = require('telegraf');

const db = require( '../lib/database' );

const log = require( '../lib/logger' );

const debug = require( 'debug' )( "inc:telegram" );

/**
 * Our Telegram stuff
 */
const that = module.exports = {};

// Our bot
let bot;

// Do we have a bot token?
if( config.telegram.botToken ) {
	// Create the bot
	bot = new Telegraf( config.telegram.botToken );

	// Command to enable the alerts
	bot.command( "enable_alerts", async ctx=>{
		try {
			debug( "Subscription", ctx );

			const exists = await db.TelegramChat.findOne( { 'where' : { 'telegramID' : ctx.chat.id } } );

			// Already?
			if( exists ) {
				// Send a message back
				bot.telegram.sendMessage( ctx.chat.id, "You are already enabled for alerts." );
			}
			else {
				// Add it
				await db.TelegramChat.create( { 'telegramID' : ctx.chat.id } );

				// Let's do 
				bot.telegram.sendMessage( ctx.chat.id, "Enabled you for alerts." );
			}
		}
		catch( e ) {
			log.message.warn( "Error saving chat ID for Telegram", e, ctx );
		}
	} );

	// Lunch the bot.
	// Lunch. Yum.
	bot.launch();
}
else
	log.message.warn( "No Telegram bot token specified. Going without one." );

/**
 * Send a message
 */
that.sendMessage = async function( message ) {
	// We don't have a bot, don't send a message
	if( !bot )
		return( debug( "No bot. Ending." ) );
	
	debug( "Attempting to send message", message );

	// Get all chats to message
	const chats = await db.TelegramChat.findAll();

	// Send to each
	for( const chat of chats ) {
		try {
			// Send it
			bot.telegram.sendMessage( chat.telegramID, message );
		}
		catch( e ) {
			log.message.warn( "Could not send message to chat %d on Telegram. Deleting.", chat.telegramID, e );

			// Kill it
			await chat.destroy().catch( e=>log.message.warn( "Error destroying chat Telegram chat %d.", chat.telegramID ) );
		}
	}
};

//bot.telegram.getChat( "@mikealeonetti" ).then( console.log ).catch( console.error );

//bot.telegram.sendMessage( 1741481436, "The bot has completed botting." ).then( console.log ).catch( console.error );

//bot.launch();
