#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const {
  GROVE_QUEST_AUDIT_MANIFEST,
  GROVE_QUEST_AUDIT_MANIFEST_VERSION,
  groveQuestAuditTriggerKinds,
} = require("../../src/shared/harthmere/grove/grove_quest_audit_manifest");

const root = path.resolve(__dirname, "../..");
const destination = path.resolve(
  process.argv[2] ||
    path.join(root, "artifacts/grove-quest-audit-manifest-2026-08-07.json")
);
fs.mkdirSync(path.dirname(destination), { recursive: true });
const questIds = [...new Set(GROVE_QUEST_AUDIT_MANIFEST.map((row) => row.questId))];
fs.writeFileSync(
  destination,
  `${JSON.stringify(
    {
      version: GROVE_QUEST_AUDIT_MANIFEST_VERSION,
      generatedAt: new Date().toISOString(),
      questCount: questIds.length,
      objectiveCount: GROVE_QUEST_AUDIT_MANIFEST.length,
      triggerKinds: groveQuestAuditTriggerKinds(),
      questIds,
      rows: GROVE_QUEST_AUDIT_MANIFEST,
    },
    null,
    2
  )}\n`
);
console.log(destination);

