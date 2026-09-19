"""Settlement transaction adapter boundary for the Python runtime."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import tempfile

from pysui.sui.sui_common.sui_commands import ExecuteTransaction


@dataclass(frozen=True)
class SuiSettlementConfig:
    package_id: str
    settlement_id: str
    signer_cap_id: str
    escrow_id: str
    coin_type: str = "0x2::sui::SUI"
    target: str = "settlement::settle_run_flat"


def build_settle_run_request(config: SuiSettlementConfig, run_id: str, usages: list[tuple[str, int]]) -> dict:
    """Produce the exact Move call and BCS inputs for a Python PTB executor."""
    return {
        "target": f"{config.package_id}::{config.target}",
        "type_arguments": [config.coin_type],
        "arguments": [
            config.settlement_id,
            config.signer_cap_id,
            config.escrow_id,
            list(run_id.encode("utf-8")),
            [list(agent_id.encode("utf-8")) for agent_id, _ in usages],
            [output_tokens for _, output_tokens in usages],
        ],
    }


async def execute_settle_run(transaction, config: SuiSettlementConfig, run_id: str, usages: list[tuple[str, int]], *, gas_budget: int = 10_000_000):
    """Populate a pysui transaction and return its signed execution payload.

    The caller owns RPC submission so it can dry-run and persist the receipt
    before broadcasting the signed payload.
    """
    request = build_settle_run_request(config, run_id, usages)
    # The upgraded wrapper accepts only transaction-safe primitive vectors, so
    # pysui can resolve &mut shared objects and the owned capability from ABI.
    await transaction.move_call(
        target=request["target"],
        arguments=request["arguments"],
        type_arguments=request["type_arguments"],
    )
    return await transaction.build_and_sign(gas_budget=gas_budget)


async def submit_settle_run(client, transaction, config: SuiSettlementConfig, run_id: str, usages: list[tuple[str, int]], *, gas_budget: int = 10_000_000):
    """Build, sign, and submit through the supplied pysui protocol client."""
    signed_payload = await execute_settle_run(transaction, config, run_id, usages, gas_budget=gas_budget)
    command = ExecuteTransaction(
        tx_bytestr=signed_payload["tx_bytestr"], sig_array=signed_payload["sig_array"]
    )
    result = await client.execute(command=command)
    if result.is_err():
        raise RuntimeError(f"Sui settlement submission failed: {result.result_string}")
    executed = result.result_data
    status = getattr(getattr(executed, "effects", None), "status", None)
    if status is not None and not getattr(status, "success", False):
        raise RuntimeError(f"Sui settlement execution failed: {getattr(status, 'error', status)}")
    return executed


async def submit_receipt(receipt: dict) -> dict:
    """Submit a verified receipt using the active Sui CLI profile."""
    from pysui.sui.sui_common.config.pysui_config import PysuiConfiguration
    from pysui.sui.sui_grpc.pgrpc_clients import GrpcProtocolClient

    config = SuiSettlementConfig(
        package_id="0x00bffdd9ce936c6a0bef35a08d5fa7a7f20666305c05bceed663d47699a1238c",
        settlement_id="0x4992411d16fa3e84a25222d5119d5ed583fc9ec80508b39e8c643004cdc6482f",
        signer_cap_id="0xd024343d89b6363b02285ea4f728a59aa0c3363d32dd98d4998ea2ed49c01267",
        escrow_id="0x4b3d24770aaadbe2762c5ac5f442e6fe85c824f2e6282c68885d154e44f744d0",
    )
    usages = [(item["agentId"], int(item["outputTokens"])) for item in receipt["usages"]]
    with tempfile.TemporaryDirectory() as directory:
        sdk = PysuiConfiguration.initialize_config(
            in_folder=Path(directory),
            init_groups=[{"name": "sui_grpc_config", "grpc_from_sui": True, "make_active": True}],
        )
        client = GrpcProtocolClient(pysui_config=sdk)
        transaction = await client.transaction()
        result = await submit_settle_run(client, transaction, config, receipt["runId"], usages)
    return {**receipt, "status": "settled", "transactionDigest": result.digest}
