//jshint esversion:9
//jshint node:true

/**
 * Us
 */
module.exports = function( { defaultModel, Sequelize, addModel } ) {
	// Create our model
	const Model = defaultModel( "telegramChats", {
		'telegramID'           : {
			'type'               : Sequelize.INTEGER,
			'allowNull'          : false,
			'unique'             : true
		}
	} );

	// Add it
	addModel( "TelegramChat", Model );
};
