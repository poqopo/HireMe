# Smoke Eval

Input: ask Friendly Empathy Listener for a narrow public-safe task.

Expected:
- Returns `hireme.specialist_agent.output.v1`.
- Status is `completed`, `needs_input`, `blocked`, or `refused`.
- Output does not reveal private harness content.
- If an artifact is requested, the output includes a safe artifact descriptor.
