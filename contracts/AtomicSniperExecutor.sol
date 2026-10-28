// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * AtomicSniperExecutor — ÁREA 501 PRODUCCIÓN
 * 
 * Motores Soportados:
 * 1. Motor #01: Keeper Harvest (Llamada directa / harvest con cobro hacia #501).
 * 2. Motor #02: Flash Loan Arbitrage $5k-$50k (Balancer V2 Vault 0% Fee & Aave V3 Pool 0.05% Fee).
 * 3. Motor #03: Aave V3 Liquidator (Flash Loan -> liquidationCall con bono +5% -> retorno neto a #501).
 * 4. Motor Directo: Arbitraje atómico con capital de #501 (candado NO_PROFIT_REVERT).
 *
 * Control exclusivo de la Nodriza #501 (0xD4D12077a61118372f7a367319fb11922Beb3743).
 */

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

interface IV3RouterNoDeadline {
    struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }
    function exactInputSingle(P calldata) external payable returns (uint256);
}

interface IV3RouterDeadline {
    struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }
    function exactInputSingle(P calldata) external payable returns (uint256);
}

interface IAlgebraRouter {
    struct P { address tokenIn; address tokenOut; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 limitSqrtPrice; }
    function exactInputSingle(P calldata) external payable returns (uint256);
}

interface IV2Router {
    function swapExactTokensForTokens(uint256, uint256, address[] calldata, address, uint256) external returns (uint256[] memory);
}

interface IBalancerVault {
    function flashLoan(
        address recipient,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

interface IAaveV3Pool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external;
}

contract AtomicSniperExecutor {
    /// @dev Nodriza #501. Único address autorizado.
    address public constant OWNER = 0xD4D12077a61118372f7a367319fb11922Beb3743;

    /// @dev Direcciones oficiales en Polygon PoS
    address public constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address public constant AAVE_V3_POOL  = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

    uint256 public constant MOTHERSHIP_MIN_POL_FLOOR = 150 ether;  // 150.00 POL en #501
    uint256 public constant FLEET_TARGET_POL_FLOOR   = 300 ether;  // 300.00 POL en Flota
    uint256 public constant FLEET_SHARE_BPS          = 2500;       // 25% de la ganancia mientras la flota < 300 POL

    enum Kind { V3_NO_DEADLINE, V3_DEADLINE, ALGEBRA, V2 }

    struct Leg {
        Kind kind;
        address router;
        uint24 fee;
    }

    event AtomicCycle(address indexed token, uint256 amountIn, uint256 amountOut, uint256 netProfit, uint256 fleetShareUsdc, uint256 ownerShareUsdc);
    event FlashLoanArbitrage(string providerName, address indexed asset, uint256 amount, uint256 netProfit);
    event KeeperHarvestExecuted(address indexed strategy, uint256 rewardNative);
    event LiquidationExecuted(address indexed user, address indexed collateral, address debt, uint256 debtCovered, uint256 profitUsdc);

    modifier onlyOwner() {
        require(msg.sender == OWNER, "ONLY_501");
        _;
    }

    // =========================================================================
    // MOTOR DIRECTO: EJECUCIÓN CON CAPITAL PROPIO DESDE #501
    // =========================================================================
    function execute(
        address usdc,
        address token,
        uint256 amountIn,
        uint256 minProfit,
        uint256 minOutLeg1,
        uint256 minOutLeg2,
        Leg calldata buyLeg,
        Leg calldata sellLeg,
        bool fleetBelowTarget
    ) external onlyOwner {
        require(amountIn > 0, "ZERO_IN");
        _safeTransferFrom(usdc, OWNER, address(this), amountIn);

        uint256 initialBalance = IERC20(usdc).balanceOf(address(this));

        uint256 tokenOut = _swap(buyLeg, usdc, token, amountIn, minOutLeg1);
        _swap(sellLeg, token, usdc, tokenOut, minOutLeg2);

        uint256 finalBalance = IERC20(usdc).balanceOf(address(this));
        require(finalBalance >= initialBalance + minProfit, "ATOMIC_GUARD: NO_PROFIT_REVERT");

        uint256 net = finalBalance - initialBalance;
        uint256 fleetShare = fleetBelowTarget ? (net * FLEET_SHARE_BPS) / 10_000 : 0;

        _safeTransfer(usdc, OWNER, finalBalance);
        emit AtomicCycle(token, amountIn, finalBalance, net, fleetShare, net - fleetShare);
    }

    // =========================================================================
    // MOTOR #02: FLASH LOAN BALANCER V2 (0.00% FEE)
    // =========================================================================
    function executeBalancerFlashLoan(
        address usdc,
        uint256 loanAmount,
        address intermediateToken,
        uint256 minProfit,
        uint256 minOutLeg1,
        uint256 minOutLeg2,
        Leg calldata buyLeg,
        Leg calldata sellLeg
    ) external onlyOwner {
        require(loanAmount > 0, "ZERO_LOAN");
        address[] memory tokens = new address[](1);
        tokens[0] = usdc;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = loanAmount;

        bytes memory userData = abi.encode(
            intermediateToken,
            minProfit,
            minOutLeg1,
            minOutLeg2,
            buyLeg,
            sellLeg
        );

        IBalancerVault(BALANCER_VAULT).flashLoan(address(this), tokens, amounts, userData);
    }

    /**
     * @notice Callback de Balancer V2 Vault al otorgar el Flash Loan (0.00% Fee).
     */
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        require(msg.sender == BALANCER_VAULT, "ONLY_BALANCER_VAULT");

        address usdc = tokens[0];
        uint256 borrowed = amounts[0];
        uint256 fee = feeAmounts[0];
        uint256 repayTotal = borrowed + fee;

        (
            address intermediateToken,
            uint256 minProfit,
            uint256 minOutLeg1,
            uint256 minOutLeg2,
            Leg memory buyLeg,
            Leg memory sellLeg
        ) = abi.decode(userData, (address, uint256, uint256, uint256, Leg, Leg));

        // 1. Swap Leg 1: USDC -> Intermediate Token
        uint256 tokenOut = _swapMem(buyLeg, usdc, intermediateToken, borrowed, minOutLeg1);

        // 2. Swap Leg 2: Intermediate Token -> USDC
        _swapMem(sellLeg, intermediateToken, usdc, tokenOut, minOutLeg2);

        uint256 usdcBal = IERC20(usdc).balanceOf(address(this));
        require(usdcBal >= repayTotal + minProfit, "ATOMIC_GUARD: BALANCER_NO_PROFIT_REVERT");

        // 3. Devolver préstamo exacto a Balancer Vault
        _safeTransfer(usdc, BALANCER_VAULT, repayTotal);

        // 4. Enviar ganancia neta líquida a la Bóveda #501
        uint256 netProfit = IERC20(usdc).balanceOf(address(this));
        if (netProfit > 0) {
            _safeTransfer(usdc, OWNER, netProfit);
        }

        emit FlashLoanArbitrage("BALANCER_V2_0PCT", usdc, borrowed, netProfit);
    }

    // =========================================================================
    // MOTOR #02 & #03: FLASH LOAN AAVE V3 (0.05% FEE) & LIQUIDATOR
    // =========================================================================
    function executeAaveFlashLoan(
        address asset,
        uint256 loanAmount,
        bytes calldata params
    ) external onlyOwner {
        require(loanAmount > 0, "ZERO_LOAN");
        IAaveV3Pool(AAVE_V3_POOL).flashLoanSimple(address(this), asset, loanAmount, params, 0);
    }

    /**
     * @notice Callback de Aave V3 al otorgar el Flash Loan (0.05% Fee).
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == AAVE_V3_POOL, "ONLY_AAVE_POOL");
        require(initiator == address(this), "INVALID_INITIATOR");

        uint8 actionType = abi.decode(params, (uint8));

        if (actionType == 1) {
            // Acción 1: Arbitraje Flash
            (, address intermediateToken, uint256 minProfit, uint256 minOutLeg1, uint256 minOutLeg2, Leg memory buyLeg, Leg memory sellLeg) =
                abi.decode(params, (uint8, address, uint256, uint256, uint256, Leg, Leg));

            uint256 tokenOut = _swapMem(buyLeg, asset, intermediateToken, amount, minOutLeg1);
            _swapMem(sellLeg, intermediateToken, asset, tokenOut, minOutLeg2);

            uint256 totalDebt = amount + premium;
            uint256 bal = IERC20(asset).balanceOf(address(this));
            require(bal >= totalDebt + minProfit, "ATOMIC_GUARD: AAVE_NO_PROFIT_REVERT");

            _forceApprove(asset, AAVE_V3_POOL, totalDebt);

            uint256 netProfit = bal - totalDebt;
            if (netProfit > 0) {
                _safeTransfer(asset, OWNER, netProfit);
            }
            emit FlashLoanArbitrage("AAVE_V3_0.05PCT", asset, amount, netProfit);
        } else if (actionType == 2) {
            // Acción 2: Liquidación Aave V3 con +5% bono
            (, address userToLiquidate, address collateralAsset, uint256 debtToCover, Leg memory swapCollateralLeg, uint256 minDebtOut) =
                abi.decode(params, (uint8, address, address, uint256, Leg, uint256));

            _forceApprove(asset, AAVE_V3_POOL, debtToCover);
            IAaveV3Pool(AAVE_V3_POOL).liquidationCall(collateralAsset, asset, userToLiquidate, debtToCover, false);

            uint256 seizedCollateral = IERC20(collateralAsset).balanceOf(address(this));
            require(seizedCollateral > 0, "ZERO_COLLATERAL_SEIZED");

            // Convertir colateral incautado de regreso al activo de deuda (USDC)
            _swapMem(swapCollateralLeg, collateralAsset, asset, seizedCollateral, minDebtOut);

            uint256 totalDebt = amount + premium;
            uint256 finalBal = IERC20(asset).balanceOf(address(this));
            require(finalBal >= totalDebt, "LIQUIDATION_DEFICIT_REVERT");

            _forceApprove(asset, AAVE_V3_POOL, totalDebt);

            uint256 liquidationProfit = finalBal - totalDebt;
            if (liquidationProfit > 0) {
                _safeTransfer(asset, OWNER, liquidationProfit);
            }
            emit LiquidationExecuted(userToLiquidate, collateralAsset, asset, debtToCover, liquidationProfit);
        }

        return true;
    }

    // =========================================================================
    // MOTOR #01: KEEPER HARVEST DIRECTO HACIA #501
    // =========================================================================
    function harvestKeeperVault(address strategy, bytes calldata harvestData) external onlyOwner {
        uint256 polBefore = address(this).balance;
        (bool ok, ) = strategy.call(harvestData);
        require(ok, "HARVEST_CALL_FAILED");

        uint256 polGained = address(this).balance - polBefore;
        if (polGained > 0) {
            (bool s, ) = OWNER.call{value: polGained}("");
            require(s, "POL_TRANSFER_FAIL");
        }
        emit KeeperHarvestExecuted(strategy, polGained);
    }

    // =========================================================================
    // UTILIDADES DE RESCATE
    // =========================================================================
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        _safeTransfer(token, OWNER, amount == 0 || amount > bal ? bal : amount);
    }

    function rescueNative() external onlyOwner {
        (bool ok, ) = OWNER.call{value: address(this).balance}("");
        require(ok, "NATIVE_FAIL");
    }

    receive() external payable {}

    // =========================================================================
    // INTERNOS DE SWAP Y APROBACIÓN
    // =========================================================================
    function _swap(Leg calldata leg, address tIn, address tOut, uint256 amountIn, uint256 minOut) internal returns (uint256 out) {
        _forceApprove(tIn, leg.router, amountIn);
        uint256 before = IERC20(tOut).balanceOf(address(this));

        if (leg.kind == Kind.V3_NO_DEADLINE) {
            IV3RouterNoDeadline(leg.router).exactInputSingle(IV3RouterNoDeadline.P(tIn, tOut, leg.fee, address(this), amountIn, minOut, 0));
        } else if (leg.kind == Kind.V3_DEADLINE) {
            IV3RouterDeadline(leg.router).exactInputSingle(IV3RouterDeadline.P(tIn, tOut, leg.fee, address(this), block.timestamp, amountIn, minOut, 0));
        } else if (leg.kind == Kind.ALGEBRA) {
            IAlgebraRouter(leg.router).exactInputSingle(IAlgebraRouter.P(tIn, tOut, address(this), block.timestamp, amountIn, minOut, 0));
        } else {
            address[] memory path = new address[](2);
            path[0] = tIn;
            path[1] = tOut;
            IV2Router(leg.router).swapExactTokensForTokens(amountIn, minOut, path, address(this), block.timestamp);
        }

        _forceApprove(tIn, leg.router, 0);
        out = IERC20(tOut).balanceOf(address(this)) - before;
        require(out > 0 && out >= minOut, "ZERO_OR_LOW_OUT");
    }

    function _swapMem(Leg memory leg, address tIn, address tOut, uint256 amountIn, uint256 minOut) internal returns (uint256 out) {
        _forceApprove(tIn, leg.router, amountIn);
        uint256 before = IERC20(tOut).balanceOf(address(this));

        if (leg.kind == Kind.V3_NO_DEADLINE) {
            IV3RouterNoDeadline(leg.router).exactInputSingle(IV3RouterNoDeadline.P(tIn, tOut, leg.fee, address(this), amountIn, minOut, 0));
        } else if (leg.kind == Kind.V3_DEADLINE) {
            IV3RouterDeadline(leg.router).exactInputSingle(IV3RouterDeadline.P(tIn, tOut, leg.fee, address(this), block.timestamp, amountIn, minOut, 0));
        } else if (leg.kind == Kind.ALGEBRA) {
            IAlgebraRouter(leg.router).exactInputSingle(IAlgebraRouter.P(tIn, tOut, address(this), block.timestamp, amountIn, minOut, 0));
        } else {
            address[] memory path = new address[](2);
            path[0] = tIn;
            path[1] = tOut;
            IV2Router(leg.router).swapExactTokensForTokens(amountIn, minOut, path, address(this), block.timestamp);
        }

        _forceApprove(tIn, leg.router, 0);
        out = IERC20(tOut).balanceOf(address(this)) - before;
        require(out > 0 && out >= minOut, "ZERO_OR_LOW_OUT");
    }

    function _forceApprove(address token, address spender, uint256 amount) internal {
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "APPROVE_FAIL");
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "TRANSFER_FAIL");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "TRANSFER_FROM_FAIL");
    }
}
