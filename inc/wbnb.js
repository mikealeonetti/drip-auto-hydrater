//jshint esversion:9
//jshint node:true
const config = require( '../lib/config' );
const bsc = require( './bsc' );

// Export the faucet
const that = module.exports = new bsc.eth.Contract( config.ERC20_TOKEN_ABI, config.WBNB_ADDRESS );

that.weiUnit = config.WBNB_WEIUNIT;
that.numberOfDecimals = config.WBNB_DECIMALS;
