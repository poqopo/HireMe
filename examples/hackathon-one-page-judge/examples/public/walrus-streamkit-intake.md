# WalrusStreamKit Intake Example

## Input

Review this DeepSurge project for Sui Overflow:

https://www.deepsurge.xyz/projects/b286920a-7f42-4df6-82b1-f05480235df2

Target track: Walrus

## Expected Source Intake Shape

Source intake:
- Source used: DeepSurge project URL and linked project material.
- Project title: WalrusStreamKit.
- Tagline: Ownable, monetizable video infrastructure on Walrus and Sui.
- Problem: Web2 video platforms provide delivery but lock in ownership, paywalls, and payments. Web3 has decentralized components but lacks an integrated video control plane and SDK.
- Solution: A developer-first video SDK that handles upload, storage, delivery, ownership, monetization, and gated access.
- Technical architecture: Walrus stores video bytes and HLS segments as Quilt blobs; Sui Move manages Channel, VideoAsset, AccessPolicy, AccessGrant, and Subscription; Seal gates paid content by releasing keys after AccessGrant verification.
- Shipped proof: npm packages, hosted relayer, Sui testnet Move contracts, end-to-end demo app, and documentation.
- Open proof gaps: verify package links, contract link, relayer availability, demo flow, and exact Walrus/Sui artifact IDs before final scoring.

Normalized one-page description:
Project: WalrusStreamKit.
Tagline: A developer-first video SDK that lets creators own, price, deliver, and monetize video assets with Walrus and Sui.
Track: Walrus.

Problem:
Web2 video infrastructure locks creators into proprietary delivery, ownership, payments, and paywall systems. Web3 has decentralized pieces, but lacks a production-friendly SDK that connects storage, access control, delivery, and monetization.

Solution:
WalrusStreamKit provides one install for upload, store, deliver, own, monetize, and gate access. It supports public VOD, paid encrypted VOD through Seal, and pseudo-live streams that finalize into durable on-chain VOD without re-uploading.

Why this track technology matters:
Walrus is the data plane for video bytes and HLS/Quilt blobs. Sui is the control plane for ownership, access, and subscription state. Seal gates paid content by releasing decryption keys only after on-chain access verification.

Technical proof:
The project claims shipped npm packages, a hosted relayer, Sui testnet Move contracts, an end-to-end demo app, and docs.

User value:
Creators own the asset and get paid directly to their wallet instead of depending on a proprietary video platform.

Open proof gaps:
Verify the demo, package availability, explorer link, contract behavior, access gating, and playback reliability.
