/// Sui Move settlement ledger for completed HireMe MCP workflows.
///
/// The platform owns SettlementSignerCap. Possession of that capability means
/// the platform has checked the persisted MCP trace and usage receipt off-chain.
/// User content and model output never enter this package.
module hireme_settlement::settlement {
    use std::vector;
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    #[test_only]
    use sui::sui::SUI;
    #[test_only]
    use sui::test_scenario;

    const E_NOT_PLATFORM: u64 = 1;
    const E_NOT_ESCROW_OWNER: u64 = 2;
    const E_ALREADY_SETTLED: u64 = 3;
    const E_EMPTY_RUN: u64 = 4;
    const E_UNKNOWN_AGENT: u64 = 5;
    const E_INSUFFICIENT_ESCROW: u64 = 6;
    const E_INVALID_FEE: u64 = 7;
    const E_VERSION_MUTATION: u64 = 8;
    const E_NOT_SERVER_ACCOUNT: u64 = 9;
    const E_USAGE_LENGTH_MISMATCH: u64 = 10;

    /// A versioned identifier, e.g. sha3_256("owner/repo@commit-sha").
    public struct AgentProfile has copy, drop, store {
        creator: address,
        /// Smallest units of T per output token. Do not use floating point prices.
        price_per_output_token: u64,
        active: bool,
    }

    /// Metered from a successful MCP/provider response, not an estimate.
    public struct Usage has copy, drop, store {
        agent_id: vector<u8>,
        output_tokens: u64,
    }

    public struct Settlement<phantom T> has key {
        id: UID,
        /// The HireMe server's Sui address. Capability ownership plus this check
        /// makes settlement callable only by this account.
        server: address,
        platform_fee_bps: u64,
        treasury: Balance<T>,
        agents: Table<vector<u8>, AgentProfile>,
        settled_runs: Table<vector<u8>, bool>,
    }

    /// Shared escrow lets a user withdraw themselves while allowing the trusted
    /// platform signer to settle a verified successful run without a second user
    /// signature. Its owner is still checked on withdrawal.
    public struct Escrow<phantom T> has key {
        id: UID,
        owner: address,
        balance: Balance<T>,
    }

    /// Transfer this object only to the platform settlement service custody.
    public struct SettlementSignerCap has key {
        id: UID,
        settlement_id: ID,
    }

    public struct RunSettled has copy, drop {
        settlement_id: ID,
        run_id: vector<u8>,
        payer: address,
        gross: u64,
        platform_fee: u64,
    }

    public struct AgentPaid has copy, drop {
        run_id: vector<u8>,
        agent_id: vector<u8>,
        creator: address,
        output_tokens: u64,
        amount: u64,
    }

    /// Creates a shared settlement object and transfers the signing capability
    /// to the transaction sender (the HireMe settlement service).
    public fun create<T>(platform_fee_bps: u64, ctx: &mut TxContext) {
        assert!(platform_fee_bps <= 10_000, E_INVALID_FEE);
        let settlement = Settlement<T> {
            id: object::new(ctx),
            server: tx_context::sender(ctx),
            platform_fee_bps,
            treasury: balance::zero(),
            agents: table::new(ctx),
            settled_runs: table::new(ctx),
        };
        let cap = SettlementSignerCap {
            id: object::new(ctx),
            settlement_id: object::id(&settlement),
        };
        transfer::share_object(settlement);
        transfer::transfer(cap, tx_context::sender(ctx));
    }

    /// Registering the same id can only toggle active state; a price or creator
    /// change requires a new versioned agent id.
    public fun register_agent<T>(
        settlement: &mut Settlement<T>,
        cap: &SettlementSignerCap,
        agent_id: vector<u8>,
        creator: address,
        price_per_output_token: u64,
        ctx: &TxContext,
    ) {
        assert!(cap.settlement_id == object::id(settlement), E_NOT_PLATFORM);
        assert!(tx_context::sender(ctx) == settlement.server, E_NOT_SERVER_ACCOUNT);
        if (table::contains(&settlement.agents, agent_id)) {
            let old = table::borrow(&settlement.agents, agent_id);
            assert!(old.creator == creator && old.price_per_output_token == price_per_output_token, E_VERSION_MUTATION);
            let profile = table::borrow_mut(&mut settlement.agents, agent_id);
            profile.active = true;
        } else {
            table::add(&mut settlement.agents, agent_id, AgentProfile {
                creator,
                price_per_output_token,
                active: true,
            });
        }
    }

    public fun deactivate_agent<T>(
        settlement: &mut Settlement<T>, cap: &SettlementSignerCap, agent_id: vector<u8>, ctx: &TxContext
    ) {
        assert!(cap.settlement_id == object::id(settlement), E_NOT_PLATFORM);
        assert!(tx_context::sender(ctx) == settlement.server, E_NOT_SERVER_ACCOUNT);
        let profile = table::borrow_mut(&mut settlement.agents, agent_id);
        profile.active = false;
    }

    /// The user deposits a Coin<T> into a separately shared escrow object.
    public fun create_escrow<T>(funds: Coin<T>, ctx: &mut TxContext) {
        let escrow = Escrow<T> {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            balance: coin::into_balance(funds),
        };
        transfer::share_object(escrow);
    }

    public fun deposit<T>(escrow: &mut Escrow<T>, funds: Coin<T>) {
        balance::join(&mut escrow.balance, coin::into_balance(funds));
    }

    public fun withdraw<T>(escrow: &mut Escrow<T>, ctx: &mut TxContext): Coin<T> {
        assert!(escrow.owner == tx_context::sender(ctx), E_NOT_ESCROW_OWNER);
        let amount = balance::value(&escrow.balance);
        coin::from_balance(balance::split(&mut escrow.balance, amount), ctx)
    }

    /// Settles all calls in a completed workflow atomically. The signer service
    /// must independently validate the trace hash and reported output-token count
    /// before submitting this transaction.
    public fun settle_run<T>(
        settlement: &mut Settlement<T>,
        cap: &SettlementSignerCap,
        escrow: &mut Escrow<T>,
        run_id: vector<u8>,
        usages: vector<Usage>,
        ctx: &mut TxContext,
    ) {
        assert!(cap.settlement_id == object::id(settlement), E_NOT_PLATFORM);
        assert!(tx_context::sender(ctx) == settlement.server, E_NOT_SERVER_ACCOUNT);
        assert!(!vector::is_empty(&usages), E_EMPTY_RUN);
        assert!(!table::contains(&settlement.settled_runs, run_id), E_ALREADY_SETTLED);

        let mut gross = 0;
        let mut i = 0;
        while (i < vector::length(&usages)) {
            let usage = vector::borrow(&usages, i);
            let profile = table::borrow(&settlement.agents, usage.agent_id);
            assert!(profile.active, E_UNKNOWN_AGENT);
            gross = gross + usage.output_tokens * profile.price_per_output_token;
            i = i + 1;
        };
        assert!(balance::value(&escrow.balance) >= gross, E_INSUFFICIENT_ESCROW);
        table::add(&mut settlement.settled_runs, run_id, true);

        let mut fee_total = 0;
        i = 0;
        while (i < vector::length(&usages)) {
            let usage = vector::borrow(&usages, i);
            let profile = table::borrow(&settlement.agents, usage.agent_id);
            let line_gross = usage.output_tokens * profile.price_per_output_token;
            let line_fee = (line_gross * settlement.platform_fee_bps) / 10_000;
            let net = line_gross - line_fee;
            fee_total = fee_total + line_fee;
            balance::join(&mut settlement.treasury, balance::split(&mut escrow.balance, line_fee));
            transfer::public_transfer(
                coin::from_balance(balance::split(&mut escrow.balance, net), ctx), profile.creator
            );
            event::emit(AgentPaid {
                run_id: copy run_id, agent_id: copy usage.agent_id,
                creator: profile.creator, output_tokens: usage.output_tokens, amount: net,
            });
            i = i + 1;
        };
        event::emit(RunSettled {
            settlement_id: object::id(settlement), run_id, payer: escrow.owner,
            gross, platform_fee: fee_total,
        });
    }

    /// Transaction-friendly settlement entrypoint. Sui transaction pure inputs
    /// cannot contain custom Move structs, so callers provide parallel primitive
    /// vectors and this module constructs Usage values internally.
    public entry fun settle_run_flat<T>(
        settlement: &mut Settlement<T>,
        cap: &SettlementSignerCap,
        escrow: &mut Escrow<T>,
        run_id: vector<u8>,
        mut agent_ids: vector<vector<u8>>,
        mut output_tokens: vector<u64>,
        ctx: &mut TxContext,
    ) {
        assert!(vector::length(&agent_ids) == vector::length(&output_tokens), E_USAGE_LENGTH_MISMATCH);
        let mut usages = vector[];
        while (!vector::is_empty(&agent_ids)) {
            vector::push_back(&mut usages, Usage {
                agent_id: vector::pop_back(&mut agent_ids),
                output_tokens: vector::pop_back(&mut output_tokens),
            });
        };
        settle_run(settlement, cap, escrow, run_id, usages, ctx);
    }

    public fun withdraw_treasury<T>(
        settlement: &mut Settlement<T>, cap: &SettlementSignerCap, ctx: &mut TxContext
    ): Coin<T> {
        assert!(cap.settlement_id == object::id(settlement), E_NOT_PLATFORM);
        assert!(tx_context::sender(ctx) == settlement.server, E_NOT_SERVER_ACCOUNT);
        let amount = balance::value(&settlement.treasury);
        coin::from_balance(balance::split(&mut settlement.treasury, amount), ctx)
    }

    #[test]
    fun test_server_settles_one_users_escrow_and_pays_creator() {
        let server = @0xA11CE;
        let user = @0xB0B;
        let creator = @0xC0DE;
        let mut scenario = test_scenario::begin(server);
        let ctx = scenario.ctx();
        let mut settlement = Settlement<SUI> {
            id: object::new(ctx), server, platform_fee_bps: 1_000,
            treasury: balance::zero(), agents: table::new(ctx), settled_runs: table::new(ctx),
        };
        let cap = SettlementSignerCap { id: object::new(ctx), settlement_id: object::id(&settlement) };
        let agent_id = vector[1u8];
        table::add(&mut settlement.agents, agent_id, AgentProfile {
            creator, price_per_output_token: 2, active: true,
        });
        let funds = coin::mint_for_testing<SUI>(100, ctx);
        let mut escrow = Escrow<SUI> {
            id: object::new(ctx), owner: user, balance: coin::into_balance(funds),
        };
        let mut usages: vector<Usage> = vector[];
        vector::push_back(&mut usages, Usage { agent_id: vector[1u8], output_tokens: 10 });

        settle_run(&mut settlement, &cap, &mut escrow, vector[9u8], usages, ctx);

        assert!(balance::value(&escrow.balance) == 80, 0); // 100 - (10 tokens × 2)
        assert!(balance::value(&settlement.treasury) == 2, 0); // 10% platform fee
        scenario.next_tx(creator);
        let payment = scenario.take_from_sender<Coin<SUI>>();
        assert!(coin::value(&payment) == 18, 0);
        assert!(coin::burn_for_testing(payment) == 18, 0);

        let Escrow { id: escrow_id, owner: _, balance: escrow_balance } = escrow;
        assert!(balance::destroy_for_testing(escrow_balance) == 80, 0);
        object::delete(escrow_id);
        let Settlement { id, server: _, platform_fee_bps: _, treasury, mut agents, mut settled_runs } = settlement;
        assert!(balance::destroy_for_testing(treasury) == 2, 0);
        let _ = table::remove(&mut agents, vector[1u8]);
        table::destroy_empty(agents);
        let _ = table::remove(&mut settled_runs, vector[9u8]);
        table::destroy_empty(settled_runs);
        object::delete(id);
        let SettlementSignerCap { id: cap_id, settlement_id: _ } = cap;
        object::delete(cap_id);
        scenario.end();
    }

    #[test, expected_failure(abort_code = E_NOT_SERVER_ACCOUNT)]
    fun test_non_server_cannot_settle() {
        let server = @0xA11CE;
        let mut scenario = test_scenario::begin(@0xBAD);
        let ctx = scenario.ctx();
        let mut settlement = Settlement<SUI> {
            id: object::new(ctx), server, platform_fee_bps: 0,
            treasury: balance::zero(), agents: table::new(ctx), settled_runs: table::new(ctx),
        };
        let cap = SettlementSignerCap { id: object::new(ctx), settlement_id: object::id(&settlement) };
        let mut escrow = Escrow<SUI> { id: object::new(ctx), owner: @0xB0B, balance: balance::zero() };
        settle_run(&mut settlement, &cap, &mut escrow, vector[1u8], vector[Usage { agent_id: vector[1u8], output_tokens: 1 }], ctx);
        abort 0
    }

    #[test, expected_failure(abort_code = E_NOT_ESCROW_OWNER)]
    fun test_non_owner_cannot_withdraw_another_users_escrow() {
        let mut scenario = test_scenario::begin(@0xBAD);
        let ctx = scenario.ctx();
        let funds = coin::mint_for_testing<SUI>(100, ctx);
        let mut escrow = Escrow<SUI> {
            id: object::new(ctx), owner: @0xB0B, balance: coin::into_balance(funds),
        };
        let refunded = withdraw(&mut escrow, ctx);
        let _ = coin::burn_for_testing(refunded);
        abort 0
    }

    #[test, expected_failure(abort_code = E_ALREADY_SETTLED)]
    fun test_run_id_cannot_be_settled_twice() {
        let server = @0xA11CE;
        let mut scenario = test_scenario::begin(server);
        let ctx = scenario.ctx();
        let mut settlement = Settlement<SUI> {
            id: object::new(ctx), server, platform_fee_bps: 0,
            treasury: balance::zero(), agents: table::new(ctx), settled_runs: table::new(ctx),
        };
        let cap = SettlementSignerCap { id: object::new(ctx), settlement_id: object::id(&settlement) };
        table::add(&mut settlement.settled_runs, vector[7u8], true);
        let mut escrow = Escrow<SUI> { id: object::new(ctx), owner: @0xB0B, balance: balance::zero() };
        settle_run(
            &mut settlement, &cap, &mut escrow, vector[7u8],
            vector[Usage { agent_id: vector[1u8], output_tokens: 1 }], ctx,
        );
        abort 0
    }
}
