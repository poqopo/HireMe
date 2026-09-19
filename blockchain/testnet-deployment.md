# HireMe Settlement — Sui Testnet deployment

Deployed on 2026-09-19 using the `testnet` Sui CLI environment.

| Item | Value |
| --- | --- |
| Sui RPC | `https://fullnode.testnet.sui.io:443` |
| Published package ID | `0xf1d61f4e0ba411cee3b8a77a541add5e68001d2ac3e02a98eed62d46016601d9` |
| Publish transaction | `BhwzrkDT6tvJTqzrFFk1EsQrxLSPv6Dggo33tT7rh5uJ` |
| Shared Settlement object ID | `0x4992411d16fa3e84a25222d5119d5ed583fc9ec80508b39e8c643004cdc6482f` |
| Settlement creation transaction | `GyT2Z5aUkYk7wEHXvYQKp2eDKaHUwndyuEgFV1812XGy` |
| SettlementSignerCap object ID | `0xd024343d89b6363b02285ea4f728a59aa0c3363d32dd98d4998ea2ed49c01267` |
| Platform/server wallet | `0xc25f6a8ffd5bfdc3bb9d84ca3e4283f82e7e8798c1e92e7fb4fd73b0329aa777` |
| Sample user Escrow object ID | `0x4b3d24770aaadbe2762c5ac5f442e6fe85c824f2e6282c68885d154e44f744d0` |
| Escrow creation transaction | `FyU4RqRkJMtPQXrUswcooMocjNiB3egXwFEvMTMnGySJ` |
| Escrow owner | `0xc25f6a8ffd5bfdc3bb9d84ca3e4283f82e7e8798c1e92e7fb4fd73b0329aa777` |
| Escrow balance | `50,000,000` MIST (`0.05` SUI) |
| Payment coin type | `0x2::sui::SUI` |
| Platform fee | `1,000` bps (10%) |

## Cap custody and transaction signing

`SettlementSignerCap` is an owned Sui object held by the platform/server wallet above. `settle_run` requires that object **and** that the transaction sender equals the stored server address. The current testnet transactions were signed by the active local Sui CLI keystore for that wallet; no private key is recorded in this repository.

For production, move that wallet key and the Cap's transaction-signing authority to a dedicated server signer (KMS/HSM or a controlled multisig process). Do not transfer the Cap to an application user or include it in client-side transaction construction.

## Current testnet status

The Settlement treasury is zero and the sample escrow is funded but has not been charged. It is ready for the first end-to-end `settle_run` test.

## Registered test agents

Both source agents lacked a stored Creator Sui wallet and settlement price. For this testnet-only registration, the platform wallet is therefore the temporary Creator payout address and the explicit price is `1 MIST` per reported output token. A production registration must use each verified Creator wallet and a version-fixed price.

| Agent version ID (UTF-8 bytes on-chain) | Creator | Price | Registration transaction |
| --- | --- | --- | --- |
| `crypto_news_research_mcp` | `0xc25f6a8ffd5bfdc3bb9d84ca3e4283f82e7e8798c1e92e7fb4fd73b0329aa777` | `1` MIST/output token | `3cvGhhm9Vvfkuu8zPnXabQt7SRo5ypq55zi2S4T4wkYv` |
| `crypto_market_html_mcp` | `0xc25f6a8ffd5bfdc3bb9d84ca3e4283f82e7e8798c1e92e7fb4fd73b0329aa777` | `1` MIST/output token | `AtaQcBuhvxmTUBYbaWM5GAFqm1smStRC3ijzLz4pYyhW` |
