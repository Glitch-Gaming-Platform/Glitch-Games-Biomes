#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere event-state mutation tests v1", root);
const town = loadTown(root);
const eventFiles = ["src/shared/harthmere/town_events.ts", "src/shared/harthmere/event_state.ts", "src/client/game/resources/harthmere_town_events.ts", "src/client/game/renderers/local_dev/harthmere_events.ts"].map((p) => path.join(root, p));
const existing = eventFiles.filter((p) => fs.existsSync(p));
const src = [town.registrySrc, town.assetsSrc, ...existing.map((p) => fs.readFileSync(p, "utf8"))].join("\n");
const events = ["market day", "festival", "monster attack", "funeral", "protest", "fire", "plague", "thief chase", "religious ceremony", "caravan"];
const missingEvents = events.filter((event) => !new RegExp(event.replace(/ /g, "[ _-]?"), "i").test(src));
report.check("event catalog covers major town event types", missingEvents.length <= 2, missingEvents);
const requiredMutations = ["NPC positions", "dialogue", "shop availability", "guard patrols", "map markers", "crowd density", "quest options", "music", "lighting", "decorations"];
const missingMutations = requiredMutations.filter((m) => !new RegExp(m.replace(/ /g, "[ _-]?"), "i").test(src));
report.check("events declare the gameplay/world mutations they apply", missingMutations.length === 0, missingMutations);
report.check("event activation cannot block core service roads", /event.*clearance|clearance.*event|event.*lane|lane.*event|validate.*event.*collision/i.test(src), "Expected event placement/lane validation");
report.check("event state can open/close shops and move civilians/guards", /shop.*closed|closed.*shop|flee|shelter|guard.*respond|civilians.*flee|shops.*close/i.test(src), "Expected attack/fire/plague style state changes");
report.finish();
