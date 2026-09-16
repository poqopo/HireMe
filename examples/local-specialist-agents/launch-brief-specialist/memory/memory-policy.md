# Memory Policy

Only hirer-visible facts may be returned as memory deltas. Do not persist raw
private harness text, hidden examples, scratchpad, or credentials.

The current request overrides Session, User, and Bootstrap Memory. Session
Memory overrides User Memory, and User Memory overrides Bootstrap Memory.
Privacy and output-contract rules remain non-overridable Harness constraints.
