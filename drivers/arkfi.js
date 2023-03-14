//jshint esversion:11
//jshint node:true

const config = require( '../lib/config' );

const log = require( '../lib/logger' );
const db = require( '../lib/database' );
const debug = require( 'debug' )( "drivers:arkfi" );
const arkfi = require( '../inc/arkfi' );
const tg = require( '../inc/telegram' );
const DEX = require( '../inc/dex' );
const arkfiToken = require( '../inc/arkfiToken' );
const BigNumber = require( 'bignumber.js' );
const arkfiSwap = require( '../inc/arkfiSwap' );

const Web3 = require("web3");
const Account = require( '../inc/account' );

const arkfiToBUSDSwap = new DEX(
														"ARKFI",
														config.ARKFI_TOKEN_ADDR,
														config.ARKFI_TOKEN_WEIUNIT,
														config.ARKFI_TOKEN_DECIMALS,
														"BUSD",
														config.BUSD_ADDRESS,
														config.BUSD_WEIUNIT,
														config.BUSD_DECIMALS
													);

/**
 * Our driver class subclasses the main account class
 */
module.exports = class ArkFiAccount extends Account {
	/**
	 * Execute a ckaun
	 */
	async takeAction( split, sell, pk ) {
		log.message.info( "Taking an arkfi action %s", this.key );

		// Make sure each action is AT LEAST 0
		for( let i=0; i<3; ++i )
			split[ i ] = Math.max( 0, parseInt( split[ i ] ) )||0;

		
		debug( "split is", split );

		// Split the actions
		const [ compound, withdraw, airdrop ] = split;

		// Total the percent
		const totalPercent = withdraw+compound+airdrop;

		// Make sure they all add up to 100
		if( totalPercent!=100 ) {
			log.message.error( "cwa does not equal 100% but %d%", totalPercent, this.key );
			return;
		}

		// Get some variables
		let [
			availableRewards,
			ndv,
			maxPayout,
			roi,
			cwr,
			balance
		] = await Promise.all( [
			arkfi.methods.getAvailableReward( this.id ).call(),
			arkfi.methods.checkNdv( this.id ).call(),
			arkfi.methods.checkMaxPayout( this.id ).call(),
			arkfi.methods.checkRoi( this.id ).call(),
			arkfi.methods.cwr( this.id ).call(),
			arkfi.methods.principalBalance( this.id ).call(),
		] );

		// Process all of these
		availableRewards = BigNumber( availableRewards ).shiftedBy( -18 );
		ndv = BigNumber( ndv ).shiftedBy( -18 );
		maxPayout = BigNumber( maxPayout ).shiftedBy( -18 );
		roi = BigNumber( roi ).shiftedBy( -1 );
		cwr = BigNumber( cwr ).shiftedBy( -3 );
		balance = BigNumber( balance ).shiftedBy( -18 );

		debug( "availableRewards=%s, ndv=%s, maxPayout=%s, roi=%s, cwr=%s, balance=%s",
			availableRewards,
			ndv,
			maxPayout,
			roi,
			cwr,
			balance
		);

		tg.sendMessage( `${this.key} cwa execution ${compound}/${withdraw}/${airdrop}.
available=${availableRewards}
ndv=${ndv}
maxPayout=${maxPayout}
roi=${roi}%
cwr=${cwr}
balance=${balance}` );
	
		// Create a tx
		// withdraw/compound/airdrop
		const txn = arkfi.methods.takeAction( withdraw, compound, airdrop, false, false, false );

		// Execute it
		await this.executeTxn( "takeAction", txn, pk, arkfi );

		// Get the balance
		const arkfiBalance = await this.getArkfiBalance();

		tg.sendMessage( `${this.key} current arkfi balance=${arkfiBalance}.` );

		// Should we sell?
		if( sell ) {
			debug( "Going to sell." );

			log.message.info( "Going to sell on the ark site.", this.key );

			// Check the allowance
			let allowance = await arkfiToken.methods.allowance( this.id, config.ARKFI_SWAP_CONTRACT_ADDRESS ).call();

			debug( "allowance=", allowance );

			// Unwei
			allowance = Web3.utils.fromWei( allowance, arkfiToken.weiUnit );

			// Big number
			allowance = BigNumber( allowance );

			debug( "allowance=%s", allowance );

			// Do we have enough
			if( allowance.lt( arkfiBalance ) ) {
				log.message.info( "Allowance is only %s. Will get permissions for allowance.", allowance, this.key );

				// Do a mega allowance
				const allowanceTxn = arkfiToken.methods.approve( config.ARKFI_SWAP_CONTRACT_ADDRESS, Web3.utils.toTwosComplement('-1') );

				// Now do the txn
				await this.executeTxn( "approveArkfi", allowanceTxn, pk, arkfiToken );
			}

			// Unwei
			const arkfiBalanceWei = Web3.utils.toWei( arkfiBalance.toFixed( config.ARKFI_TOKEN_DECIMALS, 1 ), arkfiToken.weiUnit );

			debug( "arkfiBalanceWei=", arkfiBalanceWei );

			tg.sendMessage( `${this.key} selling ${arkfiBalance} arkfi to BUSD.` );

			// Sell it and get what we get
			const sellTxn = await arkfiSwap.methods.sellForBUSD( arkfiBalanceWei, "1" );

			// Swap it
			await this.executeTxn( "swapArkfi", sellTxn, pk, arkfiSwap );
		}
	}

	/**
	 * Get the drip balance as a big number
	 */
	async getArkfiBalance() {
			// Get our DRIP balance
			let arkfiBalance = await arkfiToken.methods.balanceOf( this.id ).call();

			// Bring it down from wei
			arkfiBalance = Web3.utils.fromWei( arkfiBalance, arkfiToken.weiUnit );

			debug( "arkfiBalance=", arkfiBalance );

			// Now to a big number
			arkfiBalance = BigNumber( arkfiBalance );

			// Returners
			return( arkfiBalance );
	}

	/**
	 * Execute the next task
	 */
	async _execute( pk, action ) {
		debug( "Action='%s'", action );

		try {
			// Get the matches
			const matches = action.match( /^(\d+)(\/(\d+)(\/(\d+))?)?(\+sell)?$/ );

			debug( "matches=", matches );

			// Test the action
			if( matches ) {
				// Break out
				const [ , c, , w, , a, sell ] = matches;

				// Execute it
				await this.takeAction( [ c, w, a ], Boolean( sell ), pk );
			}
			else {
					// Don't know this action so likely a noop
					tg.sendMessage( `${this.key} executed a NoOp.` );
					log.message.info( "Executing a NoOp on account %s", this.key );
			}
		}
		catch( e ) {
			log.message.error( "Execution failed on account %s.", e );
		}
	}
};
