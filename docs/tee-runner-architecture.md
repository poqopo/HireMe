# HireMe TEE Runner Architecture

HireMe should treat Walrus as a verifiable encrypted artifact layer, not as a private database. The privacy boundary must come from Seal key-release policy, end-to-end encrypted user input, and an attested runner.

## Privacy Statement

HireMe is not the execution trust anchor. The platform should not see either side of the private execution context:

- HireMe does not see user plaintext input.
- HireMe does not see creator plaintext agent artifacts.
- Only an attested TEE runner can decrypt both, execute the Agent, and return a signed output.
- The gateway is a router, billing coordinator, ledger writer, and runner orchestrator.

## Trust Model

The target model is:

- Hirer Codex cannot read creator `AGENTS.md`, `skills/**`, prompts, or harness code.
- HireMe platform services cannot read creator plaintext either.
- HireMe platform services cannot read hirer plaintext input, repo diffs, private task context, or intermediate execution state.
- Only an approved attested runner can decrypt both the user input and protected Agent bundle.
- Supabase is an index/cache, not the authority for protected artifact integrity.
- Sui object state and Walrus blob digests define the artifact version and access policy.

## Plaintext Visibility

| Data | Hirer Codex | HireMe Gateway | TEE Runner | Creator |
| --- | --- | --- | --- | --- |
| User raw input | Yes | No | Yes, inside TEE only | No |
| Creator `AGENTS.md` / `skills/**` | No | No | Yes, inside TEE only | Yes |
| Walrus ciphertext | Yes | Yes | Yes | Yes |
| Seal key material | No | No | Yes, inside TEE only | No |
| Final JSON output | Yes | Optional relay/ciphertext only | Yes | Optional |
| Billing metadata | Yes | Yes | Yes | Yes |

## Production Flow

```txt
Creator
  -> build AGENTS.md + skills/** + harness/**
  -> compute bundle manifest digest
  -> Seal encrypt bundle
  -> Walrus store ciphertext
  -> register AgentVersion on Sui with blobId, ciphertextDigest, manifestDigest, sealPolicyId

Hirer Codex
  -> calls HireMe MCP plugin
  -> verifies or pins an approved runner measurement
  -> encrypts user input for the attested runner public key
  -> plugin sends encrypted input, agent_id, hire receipt to gateway/router

HireMe Gateway/Router
  -> checks billing/budget/rate limits
  -> resolves AgentVersion from Sui or Supabase cache
  -> creates runner job
  -> relays encrypted user input only
  -> does not receive Seal decryption material
  -> does not inspect plaintext user input
  -> does not inspect decrypted bundle

Attested Runner
  -> starts inside TEE
  -> produces remote attestation quote
  -> exposes an attested ephemeral public key
  -> decrypts user input inside TEE only
  -> downloads Walrus ciphertext
  -> verifies ciphertext digest and AgentVersion metadata
  -> asks Seal key server for key shares with quote + hire receipt proof
  -> decrypts bundle inside TEE only
  -> executes protected Agent harness
  -> returns signed JSON output, or encrypts output back to Codex public key
```

## Input Privacy Protocol

The gateway must not receive `task` or repo context in plaintext in the production path.

1. Runner publishes an attestation quote that includes a measurement and an ephemeral public key.
2. Codex verifies the quote, or accepts a gateway-provided quote only if it chains to an approved verifier.
3. Codex encrypts the user input to the runner public key.
4. Gateway receives only `encrypted_input`, size metadata, request digest, `agent_id`, and hire receipt.
5. Runner decrypts input inside the TEE and combines it with the Seal-decrypted Agent bundle.
6. Runner returns a signed JSON output. For stricter privacy, it encrypts the output to Codex's public key and the gateway relays ciphertext only.

The platform may store digests and billing metadata, but it must not store raw input, raw output, decrypted bundle files, or intermediate scratchpads.

## Local Demo Mapping

The current repo cannot enforce a real hardware TEE locally. It uses a mock quote to lock the API shape and make the gateway/runner boundary explicit.

| Production | Local Demo |
| --- | --- |
| Nitro/TDX/SGX quote | `hireme.local-tee-attestation.v1` mock quote |
| Seal key server quote verification | local measurement string check |
| Walrus ciphertext | `.hireme/local-walrus/*.seal.json` or test Walrus blob |
| Enclave-only decrypt | `server/gateway/attestedRunner.mjs` simulated runner boundary |
| Runner signature | local HMAC signature over result digest and quote digest |
| Encrypted user input | Planned protocol field; current local smoke still accepts plaintext `task` for developer convenience |

Local limitation: the mock runs in the same Node process as the gateway during tests. That proves protocol shape, not confidentiality from the local machine owner. Until the encrypted-input path is implemented, local demo calls still pass `task` plaintext to exercise the rest of the runner flow.

## API Contract

Gateway/router endpoint:

```txt
POST /v1/tee-runner/execute
```

Input:

```json
{
  "agent_id": "example-code-reviewer",
  "agent_version_object_id": "0x...",
  "hire_receipt_object_id": "0x...",
  "encrypted_input": {
    "scheme": "hpke-x25519-aes256gcm",
    "runner_quote_digest": "sha256:...",
    "ciphertext": "base64...",
    "aad": {
      "agent_id": "example-code-reviewer",
      "agent_version_object_id": "0x...",
      "hire_receipt_object_id": "0x..."
    }
  }
}
```

Local mock input may also include `task` while the encrypted-input path is being developed.

Output must include:

```json
{
  "protocol": "hireme.attested-runner.v1",
  "attestation": {
    "verified": true,
    "measurement": "sha256:..."
  },
  "runner": {
    "teeRequired": true,
    "gatewayPlaintextAccess": false,
    "gatewayCanReadUserInput": false,
    "hirerPlaintextAccess": false
  },
  "inputPrivacy": {
    "userInputEncryptedForRunner": true,
    "gatewayCanReadUserInput": false,
    "runnerCanReadUserInputInsideTee": true
  },
  "artifactPrivacy": {
    "agentBundleEncryptedOnWalrus": true,
    "gatewayCanReadAgentBundle": false,
    "runnerCanReadAgentBundleInsideTee": true
  },
  "jsonOutput": {
    "schema": "hireme.attested_agent_json_output.v1",
    "internalLlmCalled": false,
    "proof": {
      "responseDigest": "sha256:...",
      "runnerSignature": "hmac-sha256:..."
    }
  }
}
```

## Implementation Stages

1. Local mock attestation and JSON output contract.
2. Add encrypted user input protocol and remove plaintext `task` from production gateway calls.
3. Move AgentVersion authority from Supabase to Sui objects.
4. Store only Seal ciphertext on Walrus for protected agents.
5. Verify hardware attestation before Seal key release.
6. Replace local runner HMAC with runner-held signing key generated inside TEE.
7. Optionally encrypt runner output to Codex public key so the gateway relays ciphertext only.
8. Add optional TEE attestation evidence to on-chain or audit logs.
