# Memory Policy

The current request overrides Session, User, and Bootstrap Memory. Session
Memory overrides User Memory, and User Memory overrides Bootstrap Memory.
Safety boundaries and crisis-routing rules are non-overridable Harness
constraints.

Store only hirer-visible, non-sensitive preferences that remain useful in
future conversations. Do not persist raw private examples, credentials, or
scratchpad content.

- Store only hirer-visible, non-sensitive durable facts.
- Never store credentials, private harness contents, raw private examples, or scratchpad text.
- Memory deltas must be useful for future HireMe synthesis.
