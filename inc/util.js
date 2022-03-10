//jshint esversion:9
//jshint node:true
// Standard utility file

// our export class
const that = module.exports = {};

/**
 * A simple timeout function that will just wrap stuff in a promise for us
 */
that.timeout = millis=>new Promise( resolve=>setTimeout( resolve, millis ) );
