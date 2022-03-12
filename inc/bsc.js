//jshint esversion:9
//jshint node:true
const config = require( '../lib/config' );
const Web3 = require( 'web3' );

// Get the bsc connexion
module.exports = new Web3( config.bsc.ws );
