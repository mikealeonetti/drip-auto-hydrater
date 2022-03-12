//jshint esversion:8
//jshint node:true

const { Sequelize } = require( 'sequelize' );

async function up( { 'context' : queryInterface } ) {
	// Start the transaction
	const transaction = await queryInterface.sequelize.transaction();

	try {
		// Now the pending trades table
		await queryInterface.createTable( 'properties', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			createdAt: {
				type: Sequelize.DATE
			},
			updatedAt: {
				type: Sequelize.DATE
			},
			'key'                 : {
				'type'               : Sequelize.STRING,
				'allowNull'          : false
			},
			'value'             : {
				'type'               : Sequelize.STRING,
				'allowNull'          : false,
			}
		}, { transaction } );

		// Add some indecies
		await queryInterface.addIndex(
			'properties', {
			'fields' : [ "key" ],
			'unique' : true,
			transaction
		} );

		// Commit us
		await transaction.commit();
	}
	catch( e ) {
		// Made an error so abort
		await transaction.rollback();
		// Rethrow
		throw e;
	}
}

async function down( { 'context' : queryInterface } ) {
	// Start the transaction
	const transaction = await queryInterface.sequelize.transaction();

	try {
		await queryInterface.dropTable( 'properties', { transaction } );

		await transaction.commit();
	}
	catch( e ) {
		await transaction.rollback();

		throw e;
	}
}

module.exports = { up, down };
