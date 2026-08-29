# Spine gate / ASA / label verification

Static fixture (no live stack, no patient data). Open `fixture.html` or see the Playwright captures:

- `01-collapsed-gate-summary.png` — collapsed Gate summary uses full words (Risk / Consent / Insurance / Sterilization), not `R · C · I · S`.
- `02-status-precondition.png` — STATUS `→ PROCEDURE EXECUTION` is disabled with the inline blocker listing Insurance.

Unit evidence: `src/tests/spine-gate-asa-labels.test.ts` and ASA persist cases in `encounter-spine-phase3a-nurse-isolation.test.ts`.
