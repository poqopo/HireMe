# Public Example Input

```json
{
  "schema": "hireme.specialist_agent.input.v1",
  "task": "Use Friendly Empathy Listener to produce a focused result for a public-safe task.",
  "intent": "other",
  "responseMode": "direct_answer",
  "userVisibleContext": {
    "summary": "Only public context goes here.",
    "constraints": ["Keep it concise."],
    "knownFacts": []
  },
  "requestedOutput": {
    "format": "markdown",
    "mustInclude": ["summary", "recommendations"],
    "mustAvoid": ["private internals"]
  },
  "workspaceContext": {
    "available": true,
    "summary": "No local workspace action required."
  }
}
```
