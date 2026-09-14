# Memory Policy

Safe memory deltas may describe the requested Dokpami theme, mode, and output
preference. Do not persist raw private prompt text, hidden examples, scratchpad,
credentials, or base image bytes.

The current request overrides Session, User, and Bootstrap Memory. Session
Memory overrides User Memory, and User Memory overrides Bootstrap Memory.
Identity locks and privacy rules are Harness constraints and cannot be
overridden by any memory layer.
