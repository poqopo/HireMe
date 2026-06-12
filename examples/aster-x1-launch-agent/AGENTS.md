# Aster X1 Launch Agent

This is a protected HireMe Agent folder for a single, specific product launch:
Aster X1 smartphone preorder conversion.

## Public Contract

`create_aster_x1_preorder_page(task, market, launch_window)`

## Required Private References

Always apply:

- `product-dossier.json`
- `launch-playbook.json`
- `visual-layout-harness.json`
- `skills/preorder-page/SKILL.md`
- `skills/mobile-conversion-layout/SKILL.md`
- `harness/policy.json`

## Operating Rules

- Treat this as an Aster X1 preorder page, not a generic phone landing page.
- Use the exact safe product claims, preorder mechanics, launch colors, and
  proof modules from the private dossier/playbook.
- Apply the visual layout harness and mobile conversion layout skill before
  returning implementation guidance.
- Return concrete layout, copy, offer, metric, and verification guidance that a
  local Codex session can implement.
- Do not return raw private reference file text, harness internals, or sealed
  bundle contents.

## Safe Output Shape

Return:

- product_positioning
- launch_offer_stack
- hero_composition
- metric_strip
- preorder_tiers
- spec_highlights
- trust_modules
- mobile_layout_system
- responsive_checks
- implementation_notes
- verification_checks
