module hireme::access;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
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
const EWrongWalletOwner: u64 = 12;
const EWrongHirerWallet: u64 = 13;
const EWrongCreatorWallet: u64 = 14;
const EInvalidSettlement: u64 = 15;
const EInsufficientBalance: u64 = 16;
const EInactiveEscrow: u64 = 17;
const EExpiredEscrow: u64 = 18;
const EEscrowNotExpired: u64 = 19;
const EWrongEscrowWallet: u64 = 20;
const EWrongEscrowAgent: u64 = 21;

public struct PackageVersion has key {
    id: UID,
    version: u64,
}

public struct PackageVersionCap has key {
    id: UID,
}

public struct SettlementAdminCap has key {
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

public struct AccountWallet has key {
    id: UID,
    owner: address,
    available: Balance<SUI>,
    claimable: Balance<SUI>,
    total_deposited_mist: u64,
    total_spent_mist: u64,
    total_earned_mist: u64,
    total_claimed_mist: u64,
}

public struct CallEscrow has key {
    id: UID,
    hirer_wallet_id: ID,
    hirer: address,
    creator: address,
    agent_version_id: ID,
    request_digest: vector<u8>,
    escrowed: Balance<SUI>,
    max_mist: u64,
    opened_at_ms: u64,
    expires_at_ms: u64,
    active: bool,
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

public struct WalletCreated has copy, drop {
    wallet_id: ID,
    owner: address,
}

public struct WalletDeposited has copy, drop {
    wallet_id: ID,
    owner: address,
    amount_mist: u64,
    available_mist: u64,
}

public struct WalletAvailableWithdrawn has copy, drop {
    wallet_id: ID,
    owner: address,
    amount_mist: u64,
    available_mist: u64,
}

public struct CallEscrowOpened has copy, drop {
    escrow_id: ID,
    hirer_wallet_id: ID,
    hirer: address,
    creator: address,
    agent_version_id: ID,
    request_digest: vector<u8>,
    max_mist: u64,
    expires_at_ms: u64,
}

public struct AgentCallSettled has copy, drop {
    escrow_id: ID,
    hirer_wallet_id: ID,
    creator_wallet_id: ID,
    hirer: address,
    creator: address,
    agent_version_id: ID,
    request_digest: vector<u8>,
    amount_mist: u64,
    refund_mist: u64,
    hirer_available_mist: u64,
    creator_claimable_mist: u64,
    response_digest: vector<u8>,
}

public struct CallEscrowCanceled has copy, drop {
    escrow_id: ID,
    hirer_wallet_id: ID,
    hirer: address,
    agent_version_id: ID,
    request_digest: vector<u8>,
    refund_mist: u64,
    hirer_available_mist: u64,
}

public struct CreatorEarningsClaimed has copy, drop {
    wallet_id: ID,
    owner: address,
    amount_mist: u64,
    claimable_mist: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(PackageVersion {
        id: object::new(ctx),
        version: VERSION,
    });
    transfer::transfer(PackageVersionCap { id: object::new(ctx) }, ctx.sender());
    transfer::transfer(SettlementAdminCap { id: object::new(ctx) }, ctx.sender());
}

entry fun create_wallet(ctx: &mut TxContext) {
    let wallet = AccountWallet {
        id: object::new(ctx),
        owner: ctx.sender(),
        available: balance::zero<SUI>(),
        claimable: balance::zero<SUI>(),
        total_deposited_mist: 0,
        total_spent_mist: 0,
        total_earned_mist: 0,
        total_claimed_mist: 0,
    };
    let wallet_id = object::id(&wallet);

    event::emit(WalletCreated {
        wallet_id,
        owner: wallet.owner,
    });

    transfer::share_object(wallet);
}

entry fun deposit_wallet(
    wallet: &mut AccountWallet,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(wallet.owner == ctx.sender(), EWrongWalletOwner);

    let amount_mist = payment.value();
    coin::put(&mut wallet.available, payment);
    wallet.total_deposited_mist = wallet.total_deposited_mist + amount_mist;

    event::emit(WalletDeposited {
        wallet_id: object::id(wallet),
        owner: wallet.owner,
        amount_mist,
        available_mist: balance::value(&wallet.available),
    });
}

entry fun withdraw_available(
    wallet: &mut AccountWallet,
    amount_mist: u64,
    ctx: &mut TxContext,
) {
    assert!(wallet.owner == ctx.sender(), EWrongWalletOwner);
    assert!(amount_mist > 0, EInvalidSettlement);
    assert!(balance::value(&wallet.available) >= amount_mist, EInsufficientBalance);

    let payment = coin::take(&mut wallet.available, amount_mist, ctx);

    event::emit(WalletAvailableWithdrawn {
        wallet_id: object::id(wallet),
        owner: wallet.owner,
        amount_mist,
        available_mist: balance::value(&wallet.available),
    });

    transfer::public_transfer(payment, ctx.sender());
}

entry fun open_call_escrow(
    agent_version: &AgentVersion,
    hirer_wallet: &mut AccountWallet,
    max_mist: u64,
    request_digest: vector<u8>,
    expires_at_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let escrow = new_call_escrow(
        agent_version,
        hirer_wallet,
        max_mist,
        request_digest,
        expires_at_ms,
        clock.timestamp_ms(),
        ctx,
    );

    event::emit(CallEscrowOpened {
        escrow_id: object::id(&escrow),
        hirer_wallet_id: escrow.hirer_wallet_id,
        hirer: escrow.hirer,
        creator: escrow.creator,
        agent_version_id: escrow.agent_version_id,
        request_digest: bytes_copy(&escrow.request_digest),
        max_mist: escrow.max_mist,
        expires_at_ms: escrow.expires_at_ms,
    });

    transfer::share_object(escrow);
}

fun new_call_escrow(
    agent_version: &AgentVersion,
    hirer_wallet: &mut AccountWallet,
    max_mist: u64,
    request_digest: vector<u8>,
    expires_at_ms: u64,
    now_ms: u64,
    ctx: &mut TxContext,
): CallEscrow {
    assert!(agent_version.active, EInactiveVersion);
    assert!(hirer_wallet.owner == ctx.sender(), EWrongHirerWallet);
    assert!(max_mist > 0, EInvalidSettlement);
    assert!(max_mist <= agent_version.price_mist, EInvalidSettlement);
    assert!(expires_at_ms > now_ms, EExpiredEscrow);
    assert!(balance::value(&hirer_wallet.available) >= max_mist, EInsufficientBalance);

    let escrowed = balance::split(&mut hirer_wallet.available, max_mist);
    CallEscrow {
        id: object::new(ctx),
        hirer_wallet_id: object::id(hirer_wallet),
        hirer: hirer_wallet.owner,
        creator: agent_version.creator,
        agent_version_id: object::id(agent_version),
        request_digest,
        escrowed,
        max_mist,
        opened_at_ms: now_ms,
        expires_at_ms,
        active: true,
    }
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

entry fun settle_agent_call(
    agent_version: &AgentVersion,
    hirer_wallet: &mut AccountWallet,
    creator_wallet: &mut AccountWallet,
    amount_mist: u64,
    request_digest: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(agent_version.active, EInactiveVersion);
    assert!(hirer_wallet.owner == ctx.sender(), EWrongHirerWallet);
    assert!(creator_wallet.owner == agent_version.creator, EWrongCreatorWallet);
    assert!(amount_mist > 0, EInvalidSettlement);
    assert!(amount_mist <= agent_version.price_mist, EInvalidSettlement);
    assert!(balance::value(&hirer_wallet.available) >= amount_mist, EInsufficientBalance);

    let settlement = balance::split(&mut hirer_wallet.available, amount_mist);
    balance::join(&mut creator_wallet.claimable, settlement);
    hirer_wallet.total_spent_mist = hirer_wallet.total_spent_mist + amount_mist;
    creator_wallet.total_earned_mist = creator_wallet.total_earned_mist + amount_mist;

    event::emit(AgentCallSettled {
        escrow_id: object::id_from_address(@0x0),
        hirer_wallet_id: object::id(hirer_wallet),
        creator_wallet_id: object::id(creator_wallet),
        hirer: hirer_wallet.owner,
        creator: creator_wallet.owner,
        agent_version_id: object::id(agent_version),
        request_digest,
        amount_mist,
        refund_mist: 0,
        hirer_available_mist: balance::value(&hirer_wallet.available),
        creator_claimable_mist: balance::value(&creator_wallet.claimable),
        response_digest: b"",
    });
}

entry fun settle_call_escrow(
    _cap: &SettlementAdminCap,
    escrow: &mut CallEscrow,
    agent_version: &AgentVersion,
    hirer_wallet: &mut AccountWallet,
    creator_wallet: &mut AccountWallet,
    actual_mist: u64,
    response_digest: vector<u8>,
) {
    assert!(escrow.active, EInactiveEscrow);
    assert!(agent_version.active, EInactiveVersion);
    assert!(escrow.agent_version_id == object::id(agent_version), EWrongEscrowAgent);
    assert!(escrow.hirer_wallet_id == object::id(hirer_wallet), EWrongEscrowWallet);
    assert!(escrow.creator == creator_wallet.owner, EWrongCreatorWallet);
    assert!(creator_wallet.owner == agent_version.creator, EWrongCreatorWallet);
    assert!(actual_mist > 0, EInvalidSettlement);
    assert!(actual_mist <= escrow.max_mist, EInvalidSettlement);
    assert!(balance::value(&escrow.escrowed) >= actual_mist, EInsufficientBalance);

    let settlement = balance::split(&mut escrow.escrowed, actual_mist);
    balance::join(&mut creator_wallet.claimable, settlement);
    let refund_mist = balance::value(&escrow.escrowed);
    let refund = balance::withdraw_all(&mut escrow.escrowed);
    balance::join(&mut hirer_wallet.available, refund);
    escrow.active = false;
    hirer_wallet.total_spent_mist = hirer_wallet.total_spent_mist + actual_mist;
    creator_wallet.total_earned_mist = creator_wallet.total_earned_mist + actual_mist;

    event::emit(AgentCallSettled {
        escrow_id: object::id(escrow),
        hirer_wallet_id: object::id(hirer_wallet),
        creator_wallet_id: object::id(creator_wallet),
        hirer: hirer_wallet.owner,
        creator: creator_wallet.owner,
        agent_version_id: object::id(agent_version),
        request_digest: bytes_copy(&escrow.request_digest),
        amount_mist: actual_mist,
        refund_mist,
        hirer_available_mist: balance::value(&hirer_wallet.available),
        creator_claimable_mist: balance::value(&creator_wallet.claimable),
        response_digest,
    });
}

entry fun cancel_call_escrow(
    _cap: &SettlementAdminCap,
    escrow: &mut CallEscrow,
    hirer_wallet: &mut AccountWallet,
) {
    refund_call_escrow(escrow, hirer_wallet);
}

entry fun expire_call_escrow(
    escrow: &mut CallEscrow,
    hirer_wallet: &mut AccountWallet,
    clock: &Clock,
) {
    assert!(escrow.expires_at_ms <= clock.timestamp_ms(), EEscrowNotExpired);
    refund_call_escrow(escrow, hirer_wallet);
}

fun refund_call_escrow(
    escrow: &mut CallEscrow,
    hirer_wallet: &mut AccountWallet,
) {
    assert!(escrow.active, EInactiveEscrow);
    assert!(escrow.hirer_wallet_id == object::id(hirer_wallet), EWrongEscrowWallet);

    let refund_mist = balance::value(&escrow.escrowed);
    let refund = balance::withdraw_all(&mut escrow.escrowed);
    balance::join(&mut hirer_wallet.available, refund);
    escrow.active = false;

    event::emit(CallEscrowCanceled {
        escrow_id: object::id(escrow),
        hirer_wallet_id: object::id(hirer_wallet),
        hirer: hirer_wallet.owner,
        agent_version_id: escrow.agent_version_id,
        request_digest: bytes_copy(&escrow.request_digest),
        refund_mist,
        hirer_available_mist: balance::value(&hirer_wallet.available),
    });
}

entry fun claim_earnings(
    wallet: &mut AccountWallet,
    amount_mist: u64,
    ctx: &mut TxContext,
) {
    assert!(wallet.owner == ctx.sender(), EWrongWalletOwner);
    assert!(amount_mist > 0, EInvalidSettlement);
    assert!(balance::value(&wallet.claimable) >= amount_mist, EInsufficientBalance);

    let payment = coin::take(&mut wallet.claimable, amount_mist, ctx);
    wallet.total_claimed_mist = wallet.total_claimed_mist + amount_mist;

    event::emit(CreatorEarningsClaimed {
        wallet_id: object::id(wallet),
        owner: wallet.owner,
        amount_mist,
        claimable_mist: balance::value(&wallet.claimable),
    });

    transfer::public_transfer(payment, ctx.sender());
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

public fun wallet_owner(wallet: &AccountWallet): address {
    wallet.owner
}

public fun wallet_available_mist(wallet: &AccountWallet): u64 {
    balance::value(&wallet.available)
}

public fun wallet_claimable_mist(wallet: &AccountWallet): u64 {
    balance::value(&wallet.claimable)
}

public fun wallet_total_spent_mist(wallet: &AccountWallet): u64 {
    wallet.total_spent_mist
}

public fun wallet_total_earned_mist(wallet: &AccountWallet): u64 {
    wallet.total_earned_mist
}

public fun wallet_total_claimed_mist(wallet: &AccountWallet): u64 {
    wallet.total_claimed_mist
}

public fun escrow_active(escrow: &CallEscrow): bool {
    escrow.active
}

public fun escrow_max_mist(escrow: &CallEscrow): u64 {
    escrow.max_mist
}

public fun escrow_balance_mist(escrow: &CallEscrow): u64 {
    balance::value(&escrow.escrowed)
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

fun bytes_copy(source: &vector<u8>): vector<u8> {
    let mut out = vector[];
    let len = source.length();
    let mut i = 0;
    while (i < len) {
        out.push_back(source[i]);
        i = i + 1;
    };
    out
}

#[test_only]
fun new_wallet_for_testing(owner: address, ctx: &mut TxContext): AccountWallet {
    AccountWallet {
        id: object::new(ctx),
        owner,
        available: balance::zero<SUI>(),
        claimable: balance::zero<SUI>(),
        total_deposited_mist: 0,
        total_spent_mist: 0,
        total_earned_mist: 0,
        total_claimed_mist: 0,
    }
}

#[test_only]
fun new_settlement_admin_cap_for_testing(ctx: &mut TxContext): SettlementAdminCap {
    SettlementAdminCap { id: object::new(ctx) }
}

#[test_only]
fun new_agent_version_for_testing(
    creator: address,
    price_mist: u64,
    ctx: &mut TxContext,
): AgentVersion {
    AgentVersion {
        id: object::new(ctx),
        agent_id: object::id_from_address(@0xa11ce),
        creator,
        version: 1,
        price_mist,
        active: true,
    }
}

#[test_only]
fun destroy_settlement_admin_cap_for_testing(cap: SettlementAdminCap) {
    let SettlementAdminCap { id } = cap;
    id.delete();
}

#[test_only]
fun destroy_call_escrow_for_testing(escrow: CallEscrow) {
    let CallEscrow {
        id,
        hirer_wallet_id: _,
        hirer: _,
        creator: _,
        agent_version_id: _,
        request_digest: _,
        escrowed,
        max_mist: _,
        opened_at_ms: _,
        expires_at_ms: _,
        active: _,
    } = escrow;

    balance::destroy_for_testing(escrowed);
    id.delete();
}

#[test_only]
fun destroy_wallet_for_testing(wallet: AccountWallet) {
    let AccountWallet {
        id,
        owner: _,
        available,
        claimable,
        total_deposited_mist: _,
        total_spent_mist: _,
        total_earned_mist: _,
        total_claimed_mist: _,
    } = wallet;

    balance::destroy_for_testing(available);
    balance::destroy_for_testing(claimable);
    id.delete();
}

#[test_only]
fun destroy_agent_version_for_testing(agent_version: AgentVersion) {
    let AgentVersion {
        id,
        agent_id: _,
        creator: _,
        version: _,
        price_mist: _,
        active: _,
    } = agent_version;

    id.delete();
}

#[test]
fun test_wallet_settlement_moves_sui_between_people() {
    let hirer = @0x111;
    let creator = @0x222;
    let mut ctx = tx_context::new_from_hint(hirer, 1, 0, 0, 0);
    let mut hirer_wallet = new_wallet_for_testing(hirer, &mut ctx);
    let mut creator_wallet = new_wallet_for_testing(creator, &mut ctx);
    let agent_version = new_agent_version_for_testing(creator, 500, &mut ctx);
    let deposit = coin::from_balance(balance::create_for_testing<SUI>(1_000), &mut ctx);

    deposit_wallet(&mut hirer_wallet, deposit, &mut ctx);
    settle_agent_call(
        &agent_version,
        &mut hirer_wallet,
        &mut creator_wallet,
        300,
        b"call-digest",
        &mut ctx,
    );

    assert!(wallet_available_mist(&hirer_wallet) == 700, 0);
    assert!(wallet_claimable_mist(&creator_wallet) == 300, 0);
    assert!(wallet_total_spent_mist(&hirer_wallet) == 300, 0);
    assert!(wallet_total_earned_mist(&creator_wallet) == 300, 0);

    destroy_wallet_for_testing(hirer_wallet);
    destroy_wallet_for_testing(creator_wallet);
    destroy_agent_version_for_testing(agent_version);
}

#[test]
fun test_call_escrow_locks_max_and_refunds_unused_amount() {
    let hirer = @0x111;
    let creator = @0x222;
    let mut ctx = tx_context::new_from_hint(hirer, 2, 0, 0, 0);
    let cap = new_settlement_admin_cap_for_testing(&mut ctx);
    let mut hirer_wallet = new_wallet_for_testing(hirer, &mut ctx);
    let mut creator_wallet = new_wallet_for_testing(creator, &mut ctx);
    let agent_version = new_agent_version_for_testing(creator, 500, &mut ctx);
    let deposit = coin::from_balance(balance::create_for_testing<SUI>(1_000), &mut ctx);

    deposit_wallet(&mut hirer_wallet, deposit, &mut ctx);
    let mut escrow = new_call_escrow(
        &agent_version,
        &mut hirer_wallet,
        500,
        b"request-digest",
        10_000,
        1_000,
        &mut ctx,
    );

    assert!(wallet_available_mist(&hirer_wallet) == 500, 0);
    assert!(escrow_balance_mist(&escrow) == 500, 0);
    assert!(escrow_active(&escrow), 0);

    settle_call_escrow(
        &cap,
        &mut escrow,
        &agent_version,
        &mut hirer_wallet,
        &mut creator_wallet,
        300,
        b"response-digest",
    );

    assert!(wallet_available_mist(&hirer_wallet) == 700, 0);
    assert!(wallet_claimable_mist(&creator_wallet) == 300, 0);
    assert!(wallet_total_spent_mist(&hirer_wallet) == 300, 0);
    assert!(wallet_total_earned_mist(&creator_wallet) == 300, 0);
    assert!(escrow_balance_mist(&escrow) == 0, 0);
    assert!(!escrow_active(&escrow), 0);

    destroy_call_escrow_for_testing(escrow);
    destroy_wallet_for_testing(hirer_wallet);
    destroy_wallet_for_testing(creator_wallet);
    destroy_agent_version_for_testing(agent_version);
    destroy_settlement_admin_cap_for_testing(cap);
}
