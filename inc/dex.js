//jshint esversion:11
//jshint node:true
const bsc = require( './bsc' );

const BigNumber = require( 'bignumber.js' );

const { addMinutes } = require( 'date-fns/addMinutes' );

const { floor } = require( 'lodash' );

const { Token, CurrencyAmount, TradeType } = require("@uniswap/sdk-core");
const { Route, Trade, Pair } = require("@uniswap/v2-sdk");

const debug = require( 'debug' )( "inc:dex" );

const Web3 = require("web3");

const factoryAbi = [
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "getPair",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

const liqABI = [
  {
    constant: true,
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "token1",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getReserves",
    outputs: [
      { internalType: "uint112", name: "_reserve0", type: "uint112" },
      { internalType: "uint112", name: "_reserve1", type: "uint112" },
      { internalType: "uint32", name: "_blockTimestampLast", type: "uint32" },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

const uniswapABI = [ {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amountIn",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amountOutMin",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "path",
        "type": "address[]"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      }
    ],
    "name": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
} ];

const PCSRouter = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const PCSFactory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";

module.exports = class Swapper {
  constructor(
								tokenSymbol,
								tokenAddress,
								tokenWeiUnit,
								tokenDecimals,
								collateralSymbol,
								collateralAddress,
								collateralWeiUnit,
								collateralDecimals
							) {
		this.routerContract = new bsc.eth.Contract( uniswapABI, PCSRouter );
		this.tokenWeiUnit = tokenWeiUnit;
		this.tokenSymbol = tokenSymbol;
		this.tokenAddress = tokenAddress;
		this.tokenDecimals = tokenDecimals;
		this.collateralWeiUnit = collateralWeiUnit;
		this.collateralSymbol = collateralSymbol;
		this.collateralAddress = collateralAddress;
		this.collateralDecimals = collateralDecimals;

    this.tokenToken = new Token(0, tokenAddress, tokenDecimals, tokenSymbol, tokenSymbol);

		debug( "this.tokenToken=", this.tokenToken );

    this.tokenCollateral = new Token(0, collateralAddress, collateralDecimals, collateralSymbol, collateralSymbol);

		debug( "this.tokenCollateral=", this.tokenCollateral );

    this.factoryContract = new bsc.eth.Contract(factoryAbi, PCSFactory);

		debug( "this.factoryContract=", this.factoryContract );
  }

	/**
	 * The deadline time
	 */
	static getDeadlineTime() {
		return( String( floor( addMinutes( new Date(), 15 )/1000 ) ) );
	}

	/**
	 * Swap it
	 */
	async sellToken( sellToken, minimumReceivedCollateral, address ) {
		minimumReceivedCollateral = this.web3.utils.toWei( String( minimumReceivedCollateral ), this.collateralWeiUnit );
		sellToken = this.web3.utils.toWei( String( sellToken ), this.tokenWeiUnit );

		debug( "sellToken=", sellToken, "minimumReceivedCollateral=", minimumReceivedCollateral );

		// Add
		const r = await this.sendRaw( "swapExactTokensForTokensSupportingFeeOnTransferTokens", { 'callArgs' : [
			sellToken,
			minimumReceivedCollateral,
			[ this.tokenAddress, this.collateralAddress ],
			address,
			Swapper.getDeadlineTime()
		] } );

		return( r );
	}

	/**
	 * Swap it
	 */
	async buyToken( sellCollateral, minimumReceivedToken, address ) {
		sellCollateral = this.web3.utils.toWei( String( sellCollateral ), this.collateralWeiUnit );
		minimumReceivedToken = this.web3.utils.toWei( String( minimumReceivedToken ), this.tokenWeiUnit );

		debug( "sellCollateral=", sellCollateral, "minimumReceivedToken=", minimumReceivedToken );

		// Add
		const r = await this.sendRaw( "swapExactTokensForTokensSupportingFeeOnTransferTokens", { 'callArgs' : [
			sellCollateral,
			minimumReceivedToken,
			[ this.collateralAddress, this.tokenAddress ],
			address,
			Swapper.getDeadlineTime()
		] } );

		return( r );
	}

  async getPair() {
    if (!this.pair) {
			debug( "Trying to get pair" );

      const pairAddress = await this.factoryContract.methods.getPair(this.tokenAddress, this.collateralAddress).call();

			debug( "pairAddress=", pairAddress );

      this.pair = new bsc.eth.Contract(liqABI, pairAddress);
      const token0Address = await this.pair.methods.token0().call();
      const token1Address = await this.pair.methods.token1().call();
      this.token0 = [this.tokenToken, this.tokenCollateral].find((token) => token.address === token0Address);
      this.token1 = [this.tokenToken, this.tokenCollateral].find((token) => token.address === token1Address);
    }

    const reserves = await this.pair.methods.getReserves().call();

    return new Pair(
      CurrencyAmount.fromRawAmount(this.token0, reserves._reserve0.toString()),
      CurrencyAmount.fromRawAmount(this.token1, reserves._reserve1.toString())
    );
  }

  // Return from selling token (decimal)
  async tokenSellPrice(token) {
    const tokenAmount = CurrencyAmount.fromRawAmount(this.tokenToken, Web3.utils.toWei(token.toString(), this.tokenWeiUnit));
    const route = new Route([await this.getPair()], this.tokenToken, this.tokenCollateral);
    const t1 = Trade.exactIn(route, tokenAmount);

    const perUnit = BigNumber(t1.executionPrice.toSignificant(this.collateralDecimals));
		const price = perUnit.times( token );

		debug( "tokenSellPrice perUnit=", perUnit, "price=", price );

    return price;
  }

  // Price to buy token (decimal)
  async tokenBuyPrice(token) {
    const tokenAmount = CurrencyAmount.fromRawAmount(this.tokenToken, Web3.utils.toWei(token.toString(), this.tokenWeiUnit));
    const route = new Route([await this.getPair()], this.tokenCollateral, this.tokenToken);
    const t1 = Trade.exactOut(route, tokenAmount);

    const perUnit = BigNumber(t1.executionPrice.invert().toSignificant(this.collateralDecimals));
		const price = perUnit.times( token );

		debug( "tokenBuyPrice perUnit=", perUnit, "price=", price );

    return price;
  }

  // How much token for collateral (decimal)
  async tokenBuyWithCollateral(collateral) {
    const tokenAmount = CurrencyAmount.fromRawAmount(this.tokenCollateral, Web3.utils.toWei(collateral.toString(), this.collateralWeiUnit));
    const route = new Route([await this.getPair()], this.tokenCollateral, this.tokenToken);
    const t1 = Trade.exactIn(route, tokenAmount);

    const perUnit = BigNumber(t1.executionPrice.toSignificant(this.tokenDecimals));
		const price = perUnit.times( collateral );

		debug( "tokenBuyWithCollateral perUnit=", perUnit, "price=", price );

    return price;
  }
}
