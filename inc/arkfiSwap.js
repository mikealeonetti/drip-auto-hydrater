//jshint esversion:9
//jshint node:true
const config = require( '../lib/config' );
const bsc = require( './bsc' );

// Export the faucet
const that = module.exports = new bsc.eth.Contract( config.ARKFI_SWAP_ABI, config.ARKFI_SWAP_CONTRACT_ADDRESS );
