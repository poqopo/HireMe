module hireme::access;

use sui::clock::Clock;
use sui::coin::Coin;
use sui::event;
use sui::sui::SUI;

const VERSION: u64 = 1;

const ENoAccess: u64 = 1;
const EWrongCreator: u64 = 2;
const EInactiveAgent: u64 = 3;
const EInactiveVersion: u64 = 4;
const EInactiveArtifact: u64 = 5;
const EWrongArtifact: u64 = 7;
const EInvalidPayment: u64 = 8;
const EExpiredReceipt: u64 = 9;
const EInvalidReceipt: u64 = 10;
const EWrongPackageVersion: u64 = 11;

public struct PackageVersion has key {
    id: UID,
    version: u64,
}

public struct PackageVersionCap has key {
    id: UID,
}

public struct Agent has key {
    id: UID,
    creator: address,
    slug: vector<u8>,
    active: bool,
}

public struct AgentVersion has key {
    id: UID,
    agent_id: ID,
    creator: address,
    version: u64,
    price_mist: u64,
    active: bool,
}

public struct ProtectedArtifact has key {
    id: UID,
    agent_version_id: ID,
    creator: address,
    seal_id: vector<u8>,
    walrus_blob_id: vector<u8>,
    ciphertext_digest: vector<u8>,
    active: bool,
}

public struct HireReceipt has key {
    id: UID,
    hirer: address,
    agent_version_id: ID,
    artifact_id: ID,
    issued_at_ms: u64,
    expires_at_ms: u64,
    max_calls: u64,
}

public struct AgentCreated has copy, drop {
    agent_id: ID,
    creator: address,
    slug: vector<u8>,
}

public struct AgentVersionPublished has copy, drop {
    agent_version_id: ID,
    agent_id: ID,
    creator: address,
    version: u64,
    price_mist: u64,
}

public struct ProtectedArtifactRegistered has copy, drop {
    artifact_id: ID,
    agent_version_id: ID,
    creator: address,
    seal_id: vector<u8>,
    walrus_blob_id: vector<u8>,
    ciphertext_digest: vector<u8>,
}

public struct HireReceiptIssued has copy, drop {
    receipt_id: ID,
    hirer: address,
    agent_version_id: ID,
    artifact_id: ID,
    expires_at_ms: u64,
    max_calls: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(PackageVersion {
        id: object::new(ctx),
        version: VERSION,
    });
    transfer::transfer(PackageVersionCap { id: object::new(ctx) }, ctx.sender());
}

entry fun create_agent(slug: vector<u8>, ctx: &mut TxContext) {
    let agent = Agent {
        id: object::new(ctx),
        creator: ctx.sender(),
        slug,
        active: true,
    };
    let agent_id = object::id(&agent);

    event::emit(AgentCreated {
        agent_id,
        creator: agent.creator,
        slug: agent.slug,
    });

    transfer::share_object(agent);
}

entry fun publish_agent_version(
    agent: &Agent,
    version: u64,
    price_mist: u64,
    ctx: &mut TxContext,
) {
    assert!(agent.creator == ctx.sender(), EWrongCreator);
    assert!(agent.active, EInactiveAgent);

    let agent_version = AgentVersion {
        id: object::new(ctx),
        agent_id: object::id(agent),
        creator: agent.creator,
        version,
        price_mist,
        active: true,
    };
    let agent_version_id = object::id(&agent_version);

    event::emit(AgentVersionPublished {
        agent_version_id,
        agent_id: agent_version.agent_id,
        creator: agent_version.creator,
        version,
        price_mist,
    });

    transfer::share_object(agent_version);
}

entry fun register_protected_artifact(
    agent_version: &AgentVersion,
    seal_id: vector<u8>,
    walrus_blob_id: vector<u8>,
    ciphertext_digest: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(agent_version.creator == ctx.sender(), EWrongCreator);
    assert!(agent_version.active, EInactiveVersion);

    let artifact = ProtectedArtifact {
        id: object::new(ctx),
        agent_version_id: object::id(agent_version),
        creator: agent_version.creator,
        seal_id,
        walrus_blob_id,
        ciphertext_digest,
        active: true,
    };
    let artifact_id = object::id(&artifact);

    event::emit(ProtectedArtifactRegistered {
        artifact_id,
        agent_version_id: artifact.agent_version_id,
        creator: artifact.creator,
        seal_id: artifact.seal_id,
        walrus_blob_id: artifact.walrus_blob_id,
        ciphertext_digest: artifact.ciphertext_digest,
    });

    transfer::share_object(artifact);
}

entry fun hire_agent(
    agent_version: &AgentVersion,
    artifact: &ProtectedArtifact,
    payment: Coin<SUI>,
    expires_at_ms: u64,
    max_calls: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(agent_version.active, EInactiveVersion);
    assert!(artifact.active, EInactiveArtifact);
    assert!(artifact.agent_version_id == object::id(agent_version), EWrongArtifact);
    assert!(payment.value() == agent_version.price_mist, EInvalidPayment);
    assert!(expires_at_ms > clock.timestamp_ms(), EExpiredReceipt);
    assert!(max_calls > 0, EInvalidReceipt);

    transfer::public_transfer(payment, agent_version.creator);

    let receipt = HireReceipt {
        id: object::new(ctx),
        hirer: ctx.sender(),
        agent_version_id: object::id(agent_version),
        artifact_id: object::id(artifact),
        issued_at_ms: clock.timestamp_ms(),
        expires_at_ms,
        max_calls,
    };
    let receipt_id = object::id(&receipt);

    event::emit(HireReceiptIssued {
        receipt_id,
        hirer: receipt.hirer,
        agent_version_id: receipt.agent_version_id,
        artifact_id: receipt.artifact_id,
        expires_at_ms,
        max_calls,
    });

    transfer::transfer(receipt, ctx.sender());
}

public fun check_policy(
    id: vector<u8>,
    package_version: &PackageVersion,
    agent_version: &AgentVersion,
    artifact: &ProtectedArtifact,
    receipt: &HireReceipt,
    clock: &Clock,
): bool {
    assert!(package_version.version == VERSION, EWrongPackageVersion);

    if (!agent_version.active) {
        return false
    };
    if (!artifact.active) {
        return false
    };
    if (artifact.agent_version_id != object::id(agent_version)) {
        return false
    };
    if (receipt.agent_version_id != object::id(agent_version)) {
        return false
    };
    if (receipt.artifact_id != object::id(artifact)) {
        return false
    };
    if (receipt.expires_at_ms <= clock.timestamp_ms()) {
        return false
    };
    if (receipt.max_calls == 0) {
        return false
    };

    bytes_equal(&artifact.seal_id, &id)
}

entry fun seal_approve(
    id: vector<u8>,
    package_version: &PackageVersion,
    agent_version: &AgentVersion,
    artifact: &ProtectedArtifact,
    receipt: &HireReceipt,
    clock: &Clock,
) {
    assert!(
        check_policy(id, package_version, agent_version, artifact, receipt, clock),
        ENoAccess,
    );
}

fun bytes_equal(left: &vector<u8>, right: &vector<u8>): bool {
    let left_len = left.length();
    if (left_len != right.length()) {
        return false
    };

    let mut i = 0;
    while (i < left_len) {
        if (left[i] != right[i]) {
            return false
        };
        i = i + 1;
    };

    true
}
