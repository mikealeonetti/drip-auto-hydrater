//jshint esversion:9
//jshint node:true
const config = require( '../lib/config' );
const bsc = require( './bsc' );

// Export the faucet
const that = module.exports = new bsc.eth.Contract( config.DRIP_TOKEN_ABI, config.DRIP_TOKEN_ADDR );

that.weiUnit = config.DRIP_TOKEN_WEIUNIT;
that.numberOfDecimals = config.DRIP_TOKEN_DECIMALS;
