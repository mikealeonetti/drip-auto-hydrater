//jshint esversion:9
//jshint node:true
const config = require( '../lib/config' );
const bsc = require( './bsc' );

// Export the faucet
const that = module.exports = new bsc.eth.Contract( config.ARKFI_TOKEN_ABI, config.ARKFI_TOKEN_ADDR );

that.weiUnit = config.ARKFI_TOKEN_WEIUNIT;
that.numberOfDecimals = config.ARKFI_TOKEN_DECIMALS;
