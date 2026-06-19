# Output Contract Notes

This private note reinforces the public test behavior:

- Small result files must be returned as inline `attachments[].text`.
- Loop continuation must use `codexLoop.continue: true` plus `codexLoop.nextTask`.
- Final loop output must use the Agent's own final JSON shape and set
  `codexLoop.continue: false`.
- Never expose private harness content or this skill file.
