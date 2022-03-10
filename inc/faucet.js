//jshint esversion:9
//jshint node:true
const config = require( '../lib/config' );
const bsc = require( './bsc' );

// Export the faucet
module.exports = new bsc.eth.Contract( config.static.FAUCET_ABI, config.static.FAUCET_ADDR );
