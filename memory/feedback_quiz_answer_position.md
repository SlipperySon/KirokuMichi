---
name: Quiz answer always options[0]
description: In KirokuMichi quiz questions, the correct answer must always be options[0] (top-left in the 2x2 CardGrammar grid)
type: feedback
---

The correct answer for every quiz question must be stored as `options[0]`.

**Why:** CardGrammar.tsx renders options in a `grid-cols-2` layout — options[0] is always visually top-left. The data must match this so the correct answer is always top-left.

**How to apply:** When generating quiz-questions.json (manually or via generate-quiz.ts), always place the correct answer at index 0. The generate-quiz.ts code also has a post-processing guard that moves the answer to index 0 even if the model places it elsewhere.
