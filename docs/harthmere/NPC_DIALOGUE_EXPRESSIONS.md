# NPC dialogue expressions

Human NPC acting is tied to the exact authored dialogue page currently shown
by `GenericTalkDialogModalStep`. The modal publishes a browser-local expression
cue when a mapped page mounts and clears that same nonce as soon as the page is
replaced or the conversation closes. This is presentation-only state: it does
not write an ECS emote component or compete with Anima's authoritative NPC
simulation.

The catalog covers:

- 460 non-quest compendium lines: greeting, service, rumor, and farewell for
  115 human NPCs;
- 198 additive-town lines: intro, story, and location for 66 humans;
- 60 Snapshot Grove ambient lines for 20 humans;
- 50 Snapshot Grove quest `sampleDialogue` lines with human givers.

Robots, animals, hostile creatures, props, and generated chat receive no human
dialogue expression. Chapter 1 keeps its separately authored page expressions
and uses the same nonce-guarded presentation bridge.

## Editing the catalog

1. Update `src/shared/harthmere/npc_dialogue_expression_plan.ts`.
2. Regenerate the compact exact-text lookup:

   ```sh
   node scripts/harthmere/generate-npc-dialogue-expression-catalog.cjs
   ```

3. Run the focused contracts and typechecks:

   ```sh
   scripts/harthmere/t.sh file src/shared/harthmere/test/npc_dialogue_expression_catalog.test.ts
   scripts/harthmere/t.sh file src/shared/harthmere/test/npc_dialogue_expressions.test.ts src/client/components/challenges/TalkDialogModalStep.test.ts
   scripts/harthmere/t.sh file src/client/components/challenges/TalkDialogModalStep.browser.test.tsx
   NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/tsc -p tsconfig.dialogueexpressions.json
   scripts/harthmere/t.sh types:client
   ```

The runtime client imports only the generated text hashes and expression
metadata. The contract test imports the complete authored corpus, rebuilds all
768 records, rejects collisions or stale output, and verifies the explicit
non-human exclusions.
