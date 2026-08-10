# Confidential Launch Scoring

This file represents a creator-only scoring workflow that must be packaged only
inside the `hosted_secure` bundle. The local protected bundle must exclude this
path completely.

The smoke test verifies bundle separation by path and digest. Runtime output
must never quote or return this file.
