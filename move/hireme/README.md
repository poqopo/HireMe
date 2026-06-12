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
- `PackageVersion`: shared package version object passed into `seal_approve`.

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
