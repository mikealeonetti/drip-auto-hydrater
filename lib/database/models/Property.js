//jshint esversion:9
//jshint node:true

/**
 * Us
 */
module.exports = function( { defaultModel, Sequelize, addModel } ) {
	// Create our model
	const Model = defaultModel( "properties", {
		'key'                  : {
			'type'               : Sequelize.STRING,
			'allowNull'          : false
		},
		'value'                : {
			'type'               : Sequelize.STRING,
			'allowNull'          : false
		},
	} );

	// Add it
	addModel( "Property", Model );
};
