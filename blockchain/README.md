# HireMe Sui Move settlement

`sources/settlement.move` is a Sui Move package that settles a completed HireMe MCP workflow using a generic Sui `Coin<T>` (typically a stablecoin).

```text
user Coin<T> → shared Escrow<T>
successful MCP calls → verified off-chain usage receipt
platform SettlementSignerCap → settle_run
creator payments + platform treasury fee
```

The package stores only `run_id`, versioned `agent_id`, token count, and payment events. Prompts, results, tool arguments, and raw MCP traces remain off-chain.

## Ownership and authority

- Every `create_escrow` call creates a distinct shared `Escrow<T>` with `owner = tx_context::sender()`. Only that address can call `withdraw`.
- The HireMe server account is recorded when `create` is called, and it receives the owned `SettlementSignerCap`.
- `settle_run`, agent registration, deactivation, and treasury withdrawal require **both** the matching capability and a transaction sent by that recorded server account. A user cannot move escrow funds to a creator directly.
- A user can withdraw unused funds before settlement. Therefore the API should reserve the quoted maximum amount before dispatching MCP calls, and reject a run if its escrow balance cannot cover the verified final amount.

## Important operating rules

1. Register a versioned agent id, e.g. `sha3_256("owner/repo@commit-sha")`; a price or creator change requires a new id.
2. Meter only completed MCP calls using provider/MCP-reported `outputTokens`. A failed flow must never call `settle_run`.
3. Keep `SettlementSignerCap` in the platform's protected transaction-signing custody. It represents authorization to settle a verified receipt.
4. Persist the complete trace hash and usage receipt off-chain before settlement; the chain is intentionally a minimal payment ledger.

## Deployment order

1. Publish with `sui client publish --gas-budget <budget>`.
2. Call `create<T>(platform_fee_bps)` and retain the transferred `SettlementSignerCap` in platform custody.
3. Register each deployed agent version and creator address with `register_agent`.
4. Users create and fund a shared `Escrow<T>`. Following a successful run, the platform calls `settle_run`; creator payments are transferred atomically.
5. The platform can withdraw accrued fees with `withdraw_treasury`.

## Runtime integration

The runtime looks up MCP launch settings by `agentId` in its **server-side** hosted-agent registry, invokes the selected tool, and includes `settlement.usages` in the final run response. Never accept a command, endpoint, or settlement price from the `/runs` client payload. For a paid run, verify every record is `metering: "reported"`, save the trace hash, then submit `settle_run` using the platform capability.
