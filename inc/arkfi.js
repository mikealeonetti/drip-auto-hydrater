//jshint esversion:9
//jshint node:true
const config = require( '../lib/config' );
const bsc = require( './bsc' );

// Export the faucet
module.exports = new bsc.eth.Contract( config.ARKFI_VAULT_ABI, config.ARKFI_VAULT_CONTRACT_ADDRESS );
