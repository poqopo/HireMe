# Hackathon One Page Judge

Evaluates a hackathon one-page project description for prize readiness and gives concrete fixes that improve judging odds.

## Public Contract

`hackathon_one_page_judge(project_name_or_url, one_page_description, hackathon_context, target_track, constraints)`

## How To Use

Paste a project URL, project name, or one-page description. When available, include the hackathon name, judging criteria, track, prize, team constraints, and demo status.

If you provide only a project name, the Agent first tries to find the official project page and build a normalized one-page description before scoring. If the name is ambiguous, it will ask for the exact project URL.

## Pricing

1 SUI / 1M tokens
