//jshint esversion:9
//jshint node:true

const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);

const debug = require( 'debug' )( 'inc:crypt' );

const IV_SIZE = 16;

// Modules
const that = module.exports = {};

that.encrypt = function( text, key ) {
	// Get random bytes
	const iv = crypto.randomBytes( IV_SIZE );

	const cipher = crypto.createCipheriv( 'aes-256-cbc', Buffer.from( key, "base64" ), iv );

	let encrypted = cipher.update( text );

	encrypted = Buffer.concat( [ encrypted, cipher.final() ] );

	// Tap them together
	text = Buffer.concat( [ encrypted, iv ] );

	debug( "1", text );

	// Now make into base64
	text = text.toString( "base64" );

	debug( "2", text );

	// Split every 64 characters
	text = text.match( /.{1,64}/g );

	debug( "3", text );

	text = text.join( "\n" );

	debug( "4", text );

	// Return some text
	return( text );
};

that.decrypt = function( text, key ) {
	// Is it a buffer?
	if( Buffer.isBuffer( text ) )
		text = text.toString( 'utf8' ); // Convert it
	else
		text = String( text ); // Coerce to string

	// Get it from base64
	text = text.replace( /\s/g, "" );
	text = Buffer.from( text, "base64" );

	// Split what we need
	const iv = text.slice( text.length-IV_SIZE );
	text = text.slice( 0, text.length-IV_SIZE );

	let encryptedText = Buffer.from(text, 'hex');
	let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from( key, "base64" ), iv);
	let decrypted = decipher.update(encryptedText);
	decrypted = Buffer.concat([decrypted, decipher.final()]);
	return decrypted.toString();
};
