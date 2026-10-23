// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * AtomicSniperExecutor — BORRADOR PARA REVISIÓN. NO DESPLEGADO. NO AUDITADO.
 *
 * Ciclo cerrado USDC -> TOKEN -> USDC entre dos routers en UNA sola transacción.
 * Si el USDC final no supera al inicial en `minProfit`, toda la transacción revierte
 * (solo se pierde el gas del intento fallido; con eth_call previo ese gas es $0).
 *
 * Control exclusivo de la Nodriza #501. Ningún otro address puede ejecutar ni retirar.
 */

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

interface IV3RouterNoDeadline { // Uniswap SwapRouter02 / PancakeSwap SmartRouter
    struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }
    function exactInputSingle(P calldata) external payable returns (uint256);
}

interface IV3RouterDeadline { // Uniswap SwapRouter original / PancakeSwap V3 SwapRouter
    struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }
    function exactInputSingle(P calldata) external payable returns (uint256);
}

interface IAlgebraRouter { // QuickSwap Algebra V3
    struct P { address tokenIn; address tokenOut; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 limitSqrtPrice; }
    function exactInputSingle(P calldata) external payable returns (uint256);
}

interface IV2Router { // QuickSwap V2, SushiSwap V2, PancakeSwap V2, BiSwap
    function swapExactTokensForTokens(uint256, uint256, address[] calldata, address, uint256) external returns (uint256[] memory);
}

contract AtomicSniperExecutor {
    /// @dev Nodriza #501. Único address autorizado.
    address public constant OWNER = 0xD4D12077a61118372f7a367319fb11922Beb3743;

    // Reglas operativas (se aplican fuera de cadena sobre la ganancia; aquí solo se documentan y se emiten en eventos)
    uint256 public constant MOTHERSHIP_MIN_POL_FLOOR = 150 ether;  // 150.00 POL en #501
    uint256 public constant FLEET_TARGET_POL_FLOOR   = 300 ether;  // 300.00 POL en Flota
    uint256 public constant FLEET_SHARE_BPS          = 2500;       // 25% de la ganancia mientras la flota < 300 POL

    enum Kind { V3_NO_DEADLINE, V3_DEADLINE, ALGEBRA, V2 }

    struct Leg {
        Kind kind;
        address router;
        uint24 fee; // ignorado en ALGEBRA y V2
    }

    event AtomicCycle(address indexed token, uint256 amountIn, uint256 amountOut, uint256 netProfit, uint256 fleetShareUsdc, uint256 ownerShareUsdc);

    modifier onlyOwner() {
        require(msg.sender == OWNER, "ONLY_501");
        _;
    }

    /**
     * @param usdc            USDC con el que se dispara (Polygon nativo / BSC peg)
     * @param token           token intermedio (WPOL, WETH, WBTC, WBNB, USDT...)
     * @param amountIn        USDC a disparar (se jala desde #501; requiere approve previo)
     * @param minProfit       ganancia mínima en unidades de USDC (incluye costo de gas ya convertido fuera de cadena)
     * @param minOutLeg1      mínimo de token recibido en la compra (anti-sandwich), calculado fuera de cadena con la cotización menos tolerancia
     * @param minOutLeg2      mínimo de USDC recibido en la venta (anti-sandwich)
     * @param buyLeg          router y tipo de la compra  USDC -> token
     * @param sellLeg         router y tipo de la venta   token -> USDC
     * @param fleetBelowTarget true si la flota aún está bajo FLEET_TARGET_POL_FLOOR (solo etiqueta el evento)
     */
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

        uint256 initialBalance = IERC20(usdc).balanceOf(address(this)); // incluye amountIn

        uint256 tokenOut = _swap(buyLeg, usdc, token, amountIn, minOutLeg1);
        _swap(sellLeg, token, usdc, tokenOut, minOutLeg2);

        uint256 finalBalance = IERC20(usdc).balanceOf(address(this));
        require(finalBalance >= initialBalance + minProfit, "ATOMIC_GUARD: NO_PROFIT_REVERT");

        uint256 net = finalBalance - initialBalance;
        uint256 fleetShare = fleetBelowTarget ? (net * FLEET_SHARE_BPS) / 10_000 : 0;

        // Todo el USDC vuelve a #501 (la conversión de fleetShare a POL se hace fuera de cadena)
        _safeTransfer(usdc, OWNER, finalBalance);

        emit AtomicCycle(token, amountIn, finalBalance, net, fleetShare, net - fleetShare);
    }

    /// @notice Control absoluto de #501: rescata cualquier ERC20 atrapado.
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        _safeTransfer(token, OWNER, amount == 0 || amount > bal ? bal : amount);
    }

    /// @notice Rescata el nativo (POL/BNB) enviado por error.
    function rescueNative() external onlyOwner {
        (bool ok, ) = OWNER.call{value: address(this).balance}("");
        require(ok, "NATIVE_FAIL");
    }

    receive() external payable {}

    // ------------------------------------------------------------------ internos
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
