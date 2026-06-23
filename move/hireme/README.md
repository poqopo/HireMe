# HireMe Sui Package

This package is the single HireMe Sui authority package. In the MVP, artifact
decryption is platform-managed by the gateway. The same package can later be
used by an optional Seal provider for threshold key release.

Creators do not deploy a package per Agent. They send transactions to this package to create shared Agent metadata and register each protected artifact.

## Objects

- `Agent`: shared marketplace identity owned by a creator address.
- `AgentVersion`: shared version metadata with price.
- `ProtectedArtifact`: shared protected artifact metadata for one Agent version.
- `HireReceipt`: hirer-owned access ticket created after payment.
- `AccountWallet`: person-owned SUI wallet object for app balance and creator earnings.
- `PackageVersion`: shared package version object passed into `seal_approve`.

## Wallet Settlement Model

The settlement source of truth should be Sui objects, not the app database.
Each person creates one shared `AccountWallet` object. The object stores an
`owner` address and every user action checks `ctx.sender()` against that owner.
The object tracks:

- `available`: SUI deposited by the Client and spendable on paid Agent calls.
- `claimable`: SUI earned by the Creator and withdrawable through `claim_earnings`.
- lifetime counters for deposited, spent, earned, and claimed MIST.

The core flow is:

```txt
create_wallet()
deposit_wallet(account_wallet, payment_coin)
open_call_escrow(agent_version, client_wallet, max_mist, request_digest, expires_at_ms)
settle_call_escrow(admin_cap, escrow, agent_version, client_wallet, creator_wallet, actual_mist, response_digest)
claim_earnings(creator_wallet, amount_mist)
```

`open_call_escrow` is the transaction the Client signs when pressing Send. It
does not need the final cost. It locks only the Client-approved `max_mist` from
the Client wallet's `available` balance into a `CallEscrow`.

After the Agent finishes, the gateway settlement signer uses
`SettlementAdminCap` to call `settle_call_escrow`. The function verifies
`actual_mist <= max_mist`, moves the actual charge into the Creator wallet's
`claimable` balance, and refunds the unused escrow back into the Client wallet's
`available` balance.

If execution fails or the escrow expires, `cancel_call_escrow` or
`expire_call_escrow` refunds the full escrow to the Client wallet.

Trial calls should not open an escrow and should not produce creator earnings.

The current legacy `hire_agent` function still performs direct payment and
receipt creation for compatibility. The object-wallet path is the preferred
settlement model for per-person app balances.

## Optional Seal Policy

This is not required for the platform-managed MVP path.

Seal key servers evaluate:

```txt
<HIREME_SEAL_PACKAGE_ID>::access::seal_approve(
  id,
  package_version,
  agent_version,
  protected_artifact,
  hire_receipt,
  clock
)
```

The function grants access only when:

- `id` exactly matches `ProtectedArtifact.seal_id`
- the `ProtectedArtifact` belongs to the `AgentVersion`
- the `HireReceipt` belongs to the same `AgentVersion` and `ProtectedArtifact`
- the receipt has not expired
- package version, version, artifact, and receipt are valid

`seal_approve` is side-effect free and is intended for optional Seal key-server dry-run evaluation.

## Local Commands

```bash
npm run sui:build
npm run sui:publish:hireme
```

After publish, set:

```bash
HIREME_SEAL_PACKAGE_ID=<published package id>
HIREME_SEAL_APPROVE_TARGET=<package id>::access::seal_approve
```
