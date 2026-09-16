# HireMe Hybrid Execution And Billing

## Product Contract

HireMe offers two protection and pricing levels for third-party Agents.

| Execution | Package boundary | Metering | Provider cost |
| --- | --- | --- | --- |
| `local_protected` | Encrypted bundle is licensed to one device and materialized ephemerally | Fixed per run or subscription allowance | User's configured provider |
| `hosted_secure` | Secure bundle and key never reach the user device | Fixed per run or subscription allowance | User's configured provider |

Local Protected prevents casual folder inspection, package sharing, and ordinary
copying. It does not claim to defeat a device administrator, debugger, process
hook, or memory dump. Workflows that require that stronger boundary must be
placed only in the Hosted Secure bundle.

## Manifest

```json
{
  "execution": {
    "schema": "hireme.agent_execution_policy.v1",
    "defaultClass": "local_protected",
    "operations": [
      {
        "id": "standard-launch-brief",
        "executionClass": "local_protected",
        "billingKey": "local_protected",
        "default": true,
        "triggers": []
      },
      {
        "id": "confidential-launch-scoring",
        "executionClass": "hosted_secure",
        "billingKey": "hosted_secure",
        "triggers": ["private scoring", "민감한 평가"]
      }
    ]
  }
}
```

A task that matches `hosted_secure` cannot be downgraded by a local execution
request. A user may upgrade a local operation to Hosted Secure.

## Bundle Rules

- `local_protected`: shared files plus local files; every `secure/` or
  `hosted-secure/` path is excluded.
- `hosted_secure`: shared files plus secure files; every `local-only/` or
  `local-protected/` path is excluded.
- `full`: creator backup only.
- `public`: marketplace metadata only.

The split is structural. Marking an operation Hosted Secure is insufficient if
its prompts, rules, examples, or Bootstrap Memory are still present in a shared
file. Creators must move those assets under a secure-only path.

## Local License Flow

```text
payment authorization or subscription allowance
  -> entitlement and device registration check
  -> random package data key
  -> package encrypted with AES-256-GCM
  -> data key wrapped to the device X25519 public key
  -> issuer signs the short-lived license with Ed25519
  -> Native Runner verifies, unwraps, decrypts, executes, and wipes plaintext
```

`deviceBoundPackageLicense.mjs` is a cryptographic example. Production should
store the device private key as a non-exportable OS-backed key when supported
and enforce license run counts in server state. A captured local package key is
still inside the local threat model; highly sensitive content must not be in the
local bundle.

## Run Billing

The example pricing schema is `hireme.billing.pricing.v2`.

Both execution classes use a fixed creator price per authorized run. Token and
compute counts are telemetry only and are explicitly rejected as a creator
billing source. A run charge contains:

- creator run price
- platform fee in basis points

Model-provider charges stay with the provider account selected by the user and
are not passed through as HireMe creator revenue.

Money is represented as integer minor units. Floating-point currency values are
not accepted.

```text
quote
  -> authorize estimated maximum
  -> release local license or start hosted runtime
  -> success: capture fixed run amount
  -> failure before execution: void authorization
  -> post-capture correction: partial/full refund
```

Every mutation requires an idempotency key. Billing events contain only user,
Agent, execution class, opaque provider references, amount, currency, status,
and safe usage totals. They must never contain card data, raw tasks, prompts,
Harness files, package payloads, or result artifacts.

## Subscription

The example subscription includes a fixed number of Agent runs. Production subscription creation must grant or
renew `agent_access` server-side. Client applications must not write access,
run charge, creator earnings, or refund facts directly.

## Example Modules

- `executionPolicy.mjs`: operation selection and no-downgrade rule
- `deviceBoundPackageLicense.mjs`: signed device key wrapping example
- `billing.mjs`: quote and payment state machine
- `billingTools.mjs`: safe mock tools exposed to HireMe Runtime
- `paidAgentExecutionExample.mjs`: authorization-to-execution-to-capture flow

Run the complete example with:

```bash
npm run agent:hybrid-billing:smoke
```

The mock provider must be replaced before accepting real money. A production
adapter also needs verified webhooks, a durable append-only billing ledger,
provider reconciliation, tax and invoice handling, disputes, payout holds, and
creator settlement controls.
