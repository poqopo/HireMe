"""Python PTB adapter for HireMe's Sui Move settlement contract."""

from __future__ import annotations

from pysui.sui.sui_bcs import bcs


def uleb128(value: int) -> bytes:
    output = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        output.append(byte | (0x80 if value else 0))
        if not value:
            return bytes(output)


def usage_vector_bcs(usages: list[tuple[str, int]]) -> list[int]:
    """BCS encode vector<settlement::Usage { vector<u8>, u64 }>.

    This is supplied as a raw PTB pure input, bypassing CLI JSON argument parsing.
    """
    encoded = bytearray(uleb128(len(usages)))
    for agent_id, output_tokens in usages:
        if output_tokens < 0:
            raise ValueError("output_tokens must be non-negative")
        agent = agent_id.encode("utf-8")
        encoded.extend(uleb128(len(agent)))
        encoded.extend(agent)
        encoded.extend(output_tokens.to_bytes(8, "little"))
    return list(encoded)


def settlement_arguments(
    settlement_id: str, signer_cap_id: str, escrow_id: str, run_id: str, usages: list[tuple[str, int]],
) -> list:
    """Return PTB inputs; the transaction builder resolves object references by RPC."""
    # RefType values follow Sui's Move object references: mutable reference for
    # Settlement/Escrow and owned capability for SettlementSignerCap.
    shared_mut = 2
    owned = 0
    return [
        bcs.UnresolvedObjectArg.from_flags(settlement_id, is_optional=False, is_receiving=False, ref_type=shared_mut),
        bcs.UnresolvedObjectArg.from_flags(signer_cap_id, is_optional=False, is_receiving=False, ref_type=owned),
        bcs.UnresolvedObjectArg.from_flags(escrow_id, is_optional=False, is_receiving=False, ref_type=shared_mut),
        bcs.BuilderArg("Pure", list(uleb128(len(run_id.encode())) + run_id.encode())),
        bcs.BuilderArg("Pure", usage_vector_bcs(usages)),
    ]
