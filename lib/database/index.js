//jshint esversion:9
//jshint node:true
const debug = require( 'debug' )( "database:index" );

const path = require( 'path' );
const Sequelize = require( 'sequelize' );

const config = require( '../../lib/config' );

const log = require( '../../lib/logger' );

const { Umzug, SequelizeStorage } = require( 'umzug' );

// Our sequelize
const sequelize = new Sequelize( {
  'dialect' : "sqlite",
	'logging' : config.debug ? str=>log.sequelize.info( str ) : null,
	'storage' : config.path.database,
	...config.sqlite.extra
} );

// Export
const that = module.exports = {
	sequelize,
	Sequelize
};

// Extra option
that.defaultModel = function( modelName, opts, extra ) {
	const o = sequelize.define( modelName, opts, extra );

	return( o );
};

// Add this model to our object
that.addModel = function( name, model ) {
	that[ name ] = model;
};

// Authenticator
that.start = async function() {
	try {
		// Do it now
		await sequelize.authenticate();

		/*
		const umzug = new Umzug( {
			migrations: { glob: path.join( __dirname, 'migrations/*.js' ) },
			context: sequelize.getQueryInterface(),
			storage: new SequelizeStorage( { sequelize } ),
			logger: log.sequelize
		} );
		*/

		// We don't use sequelize sync
		sequelize.sync( { 'alter' : true } );
		// Umzug creates our databases
		//await umzug.up();
	}
	catch( e ) {
		// Do it
		log.sequelize.error( "Sequelize connexion error.", e );

		// Rethrow
		throw e;
	}
};

// Now apply the models to us
require( './models' )( that );
require( './associations' )( that );
