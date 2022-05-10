//jshint esversion:9
//jshint node:true
const config = require( '../lib/config' );
const bsc = require( './bsc' );

// Export the faucet
module.exports = new bsc.eth.Contract( config.STAMPEDE_ABI_FLOW_ENGINE, config.STAMPEDE_FLOW_CONTRACT_ADDRESS );
