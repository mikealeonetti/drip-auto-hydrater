//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const log = require( '../lib/logger' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "drivers:faucet" );
const faucet = require( '../inc/faucet' );
const tg = require( '../inc/telegram' );
const DEX = require( '../inc/dex' );
const dripToken = require( '../inc/dripToken' );
const fountain = require( '../inc/fountain' );
const bsc = require( '../inc/bsc' );

const Web3 = require("web3");
const Account = require( '../inc/account' );
const BigNumber = require( 'bignumber.js' );

// Get the dex to sell some BNB
const bnbToUSDCSwap = new DEX(
														"WBNB",
														config.WBNB_ADDRESS,
														config.WBNB_WEIUNIT,
														config.WBNB_DECIMALS,
														"USDC",
														config.USDC_ADDRESS,
														config.USDC_WEIUNIT,
														config.USDC_DECIMALS
													);

const dripToBUSDSwap = new DEX(
														"DRIP",
														config.DRIP_TOKEN_ADDR,
														config.DRIP_TOKEN_WEIUNIT,
														config.DRIP_TOKEN_DECIMALS,
														"BUSD",
														config.BUSD_ADDRESS,
														config.BUSD_WEIUNIT,
														config.BUSD_DECIMALS
													);


/**
 * Our driver class subclasses the main account class
 */
module.exports = class FaucetAccount extends Account {
	/**
	 * Execute a hydrate
	 */
	async executeHydrate( pk ) {
		await this.getUserInfo();

		// Check to see if we have enough gas
		if( await this.shouldExecuteClaimForGas( pk ) ) {
			debug( "Will not execute claim 'cause has been claimed for gas." );
			// Don't double process
			return;
		}

		log.message.info( "Executing a hydrate on account %s", this.key );
	
		// Create a tx
		const txn = faucet.methods.roll();

		// Execute it
		await this.executeTxn( "hydrate", txn, pk, faucet );
	}

	/**
	 * Should execute claim sell
	 */
	async shouldExecuteClaimForGas( pk ) {
		// Get how much gas there is
		const gasBalance = await this.getGasBalance();

		// Do we have a minimum gas for selling?
		let { forceSellMinGas } = this.extraConfig;

		// Do we not have it?
		if( !forceSellMinGas )
			forceSellMinGas = 0.02; // Force

		debug( "forceSellMinGas=", forceSellMinGas );

		// Is there enough?
		if( gasBalance.gt( forceSellMinGas ) ) {
			log.message.info( "We have enough gas so we don't have to sell %s", this.key );

			return( false ); // We have enough. Don't process.
		}

		await tg.sendMessage( `${this.key} triggering sell for gas because gas is only ${gasBalance}.` );

		// We don't have enough gas
		log.message.info( "We don't have enough gas so we have to sell %s", this.key );
		
		// Execute a claim and sell
		await this.executeClaim( pk, true, true, true );

		// We did process
		return( true );
	}

	/**
	 * Get the user info
	 */
	async getUserInfo() {
		// Grab this
		const [
			userInfo,
			payoutOf
		] = await Promise.all( [
			faucet.methods.users( this.id ).call(),
			faucet.methods.payoutOf( this.id ).call(),
		] );

		debug( "userInfo=", userInfo, "payoutOf=", payoutOf );

		const myUserInfo = {};

		// Convert
		for( const [ name, decimals ] of [
			[ "deposits", 18 ],
			[ "payouts", 18 ],
			[ "direct_bonus", 18 ],
			[ "match_bonus", 18 ]
		] ) {
			// Set it in the new object
			myUserInfo[ name ] = BigNumber( userInfo[ name ] ).shiftedBy( -decimals );
		}

		for( const [ name, decimals ] of [
			[ "payout", 18 ],
			[ "max_payout", 18 ],
			[ "net_payout", 18 ],
			[ "sustainability_fee", 18 ],
		] ) {
			// Set it in the new object
			myUserInfo[ name ] = BigNumber( payoutOf[ name ] ).shiftedBy( -decimals );
		}

		// The other formats
		myUserInfo.deposit_time = new Date( userInfo.deposit_time*1000 );

		// Output to TG
		await tg.sendMessage( `${this.key} DRIP wallet info:
available=${myUserInfo.payout}
available_after_tax=${myUserInfo.net_payout}
deposits=${myUserInfo.deposits}
payouts=${myUserInfo.payouts}
max_payout=${myUserInfo.max_payout}
sustainability_fee=${myUserInfo.sustainability_fee}
rewards=${myUserInfo.direct_bonus.plus( myUserInfo.match_bonus )}
last_action=${myUserInfo.deposit_time}` );
	}

	/**
	 * Execute a claim
	 */
	async executeClaim( pk, sellAfter, forceDexSell, noCheckForLowGas ) {
		await this.getUserInfo();

		// Check to see if we have enough gas
		if( !noCheckForLowGas && await this.shouldExecuteClaimForGas( pk ) ) {
			debug( "Will not execute claim 'cause has been claimed for gas." );
			// Don't double process
			return;
		}

		log.message.info( "Executing a claim on account %s", this.key );
	
		// Create a tx
		const txn = faucet.methods.claim();

		// Execute it
		await this.executeTxn( "claim", txn, pk, faucet );

		// Do we want to sell after?
		if( sellAfter ) {
			// Determine it
			log.message.info( "Sell after wanted. Attempting to execute sell.", this.key );

			// Get the DRIP balance
			const dripBalance = await this.getDripBalance();

			if( dripBalance.lt( 1 ) ) {
				log.message.info( "Refusing to sell %1 drip.", dripBalance, this.key );
				await tg.sendMessage( `${this.key} wll not sell ${dripBalance} DRIP becuase it's less than 1.` );
				return;
			}

			log.message.info( "Attempting to sell %s drip.", dripBalance, this.key );

			// Get the sell price
			let dripPriceInBNB = await fountain.methods.getTokenToBnbInputPrice(
				Web3.utils.toWei( dripBalance.toFixed(), dripToken.weiUnit )
			).call();

			// Unwei
			dripPriceInBNB = Web3.utils.fromWei( dripPriceInBNB, config.WBNB_WEIUNIT );

			// Big number it
			dripPriceInBNB = BigNumber( dripPriceInBNB );

			debug( "dripPriceInBNB=%s", dripPriceInBNB );

			// How much we'll receive after tacks
			dripPriceInBNB = dripPriceInBNB.times( 0.90 );

			debug( "dripPriceInBNB 1=%s", dripPriceInBNB );

			// How much is that in USDC?
			const dexSellPriceInUSDC = await bnbToUSDCSwap.tokenSellPrice( dripPriceInBNB.toFixed( config.WBNB_DECIMALS, 1 ) );

			debug( "dexSellPriceInUSDC=", dexSellPriceInUSDC );

			// Now calculate how much BUSD we can get
			const pcsSellPriceInBUSD = await dripToBUSDSwap.tokenSellPrice( dripBalance.times( 0.90 ).toFixed( config.DRIP_TOKEN_DECIMALS, 1 ) );

			debug( "pcsSellPriceInBUSD=", pcsSellPriceInBUSD );

			log.message.info( "DRIP evaluated DEX=%s, PCS=%s.", dexSellPriceInUSDC, pcsSellPriceInBUSD, this.key );
			tg.sendMessage( `${this.key} DRIP evaluated DEX=${dexSellPriceInUSDC}, PCS=${pcsSellPriceInBUSD}.` );

			// Choose which DEX to sell on
			if( !forceDexSell && pcsSellPriceInBUSD.gt( dexSellPriceInUSDC ) ) {
				log.message.info( "PCS price is better. Will sell on PCS.", this.key );

				// Check the allowance
				let allowance = await dripToken.methods.allowance( this.id, DEX.PCSRouter ).call();

				// Unwei
				allowance = Web3.utils.fromWei( allowance, dripToken.weiUnit );

				// Big number
				allowance = BigNumber( allowance );

				debug( "allowance=%s", allowance );

				// Do we have enough
				if( allowance.lt( dripBalance ) ) {
					log.message.info( "Allowance is only %s. Will get permissions for allowance.", allowance, this.key );

					// Do a mega allowance
					const allowanceTxn = dripToken.methods.approve( DEX.PCSRouter, Web3.utils.toTwosComplement('-1') );

					// Now do the txn
					await this.executeTxn( "approveDrip", allowanceTxn, pk, dripToken );
				}

				// Sell it and get what we get
				const sellTxn = await dripToBUSDSwap.sellToken( dripBalance.toFixed(), BigNumber( 1 ).shiftedBy( -config.BUSD_DECIMALS ).toFixed(), this.id );

				// Swap it
				await this.executeTxn( "swapDripOnPCS", sellTxn, pk, bnbToUSDCSwap.routerContract );
			}
			else {
				log.message.info( "DEX price is better. Will sell on PCS.", this.key );
				// Check the allowance
				let allowance = await dripToken.methods.allowance( this.id, fountain.options.address ).call();

				// Unwei
				allowance = Web3.utils.fromWei( allowance, dripToken.weiUnit );

				// Big number
				allowance = BigNumber( allowance );

				debug( "allowance=%s", allowance );

				// Do we have enough
				if( allowance.lt( dripBalance ) ) {
					log.message.info( "Allowance is only %s. Will get permissions for allowance.", allowance, this.key );

					// Do a mega allowance
					const allowanceTxn = dripToken.methods.approve( fountain.options.address, Web3.utils.toTwosComplement('-1') );

					// Now do the txn
					await this.executeTxn( "approveDrip", allowanceTxn, pk, dripToken );
				}

				// Swap drip.
				// We don't really care about how much drip we're going to get
				// 'cauase we're selling it no matter what
				const swapTxn = fountain.methods.tokenToBnbSwapInput(
					Web3.utils.toWei( dripBalance.toFixed(), dripToken.weiUnit ),
					String( 1 ) );

				// Execute transaction
				await this.executeTxn( "swapDripOnDex", swapTxn, pk, fountain );

				// Send a message to TG
				await tg.sendMessage( `${this.key} sold ${dripBalance} DRIP to BNB via the DEX.` );

				// Get how much gas there is
				const gasBalance = await this.getGasBalance();

				// To BigNumber
				debug( "gasBalance 2=%s", gasBalance );

				// Do we have enough BNB to sell?
				const remainingGas = gasBalance.minus( 0.05 );

				debug( "remainingGas=%s", remainingGas );

				// Should we sell?
				if( remainingGas.gt( 0 ) ) {
					log.message.info( "We have enough gas to sell. Selling %s BNB.", remainingGas, this.key );

					// Get the price
					let sellPrice = await bnbToUSDCSwap.tokenSellPrice( remainingGas );

					debug( "sellPrice=%s", sellPrice );

					// Sell it and get what we get
					const sellTxn = await bnbToUSDCSwap.sellGas( BigNumber( 1 ).shiftedBy( -config.USDC_DECIMALS ).toFixed(), this.id );

					debug( "sellTxn=", sellTxn );

					// Execute it
					await this.executeTxn( "sellDripBNBForUSDC", sellTxn, pk, bnbToUSDCSwap.routerContract,
					{
						'value' : Web3.utils.toWei( remainingGas.toFixed() )
					} );
				}
			}
		}
	}

	/**
	 * Get the drip balance as a big number
	 */
	async getDripBalance() {
			// Get our DRIP balance
			let dripBalance = await dripToken.methods.balanceOf( this.id ).call();

			// Bring it down from wei
			dripBalance = Web3.utils.fromWei( dripBalance, dripToken.weiUnit );

			debug( "dripBalance=", dripBalance );

			// Now to a big number
			dripBalance = BigNumber( dripBalance );

			// Returners
			return( dripBalance );
	}

	/**
	 * Execute the next task
	 */
	async _execute( pk, action ) {
		debug( "action='%s'", action );

		try {
			// Parse the action
			switch( action ) {
				case "hydrate":
					await this.executeHydrate( pk );
					break;
				case "claim":
					await this.executeClaim( pk );
					break;
				case "sell":
					await this.executeClaim( pk, true );
					break;
				default:
					log.message.warn( "Unknown Faucet action %s for account %s", action, this.key );
				case "noop":
					tg.sendMessage( `${this.key} executed a NoOp.` );
					log.message.info( "Executing a NoOp on account %s", this.key );
			}
		}
		catch( e ) {
			log.message.error( "Execution failed on account %s.", e );
		}
	}
};
