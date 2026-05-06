---
name: KirokuMichi Phase Decisions
description: Key implementation decisions made during development, per phase
type: project
originSessionId: 1c4173c9-f9bf-4e26-b7f3-59bac68ed5e0
---
## Phase 3 — Onboarding

### CEFR Placement Quiz
- Uses European CEFR scale (A1–C2) instead of strict JLPT, with sublevels: early/mid/late per level
- C2 uses early/late (no mid) — 17 tiers total
- 126 conversational questions, ~7 per sublevel, easy to edit in `placement-data.ts`
- Intro screen explicitly tells users this is a "useful Japanese gauge that differs slightly from strict JLPT"
- Furigana reading hints shown on A1/A2 levels only (SHOW_READING_LEVELS constant)
- Advances to next tier after 3 consecutive correct; stops and places user one tier below after 2 wrong
- Result screen shows CEFR level + approximate JLPT equivalent; allows manual override
- CEFR→JLPT mapping stored in `cefrToJlpt()` in `placement-data.ts`

### Kana Learning Placeholder
- Users who don't know kana are directed to "Kana Learning Section — Coming Soon" placeholder
- No pre-N5 quiz — users who need kana stay in the placeholder until it's built (Phase 5+)
- `needsKanaLearning` flag in OnboardingFlow tracks whether to route through learning step

### App Name
- App is named **KirokuMichi** (記録道) — "path of records"
- Source is in `app/` directory
