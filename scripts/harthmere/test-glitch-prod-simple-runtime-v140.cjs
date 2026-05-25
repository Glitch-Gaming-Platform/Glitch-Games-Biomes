#!/usr/bin/env node
/*
 * V140 is retained as a compatibility entry point for older command snippets.
 * The maintained Glitch production simple-runtime assertions live in V141.
 */
const path = require("path");
const { execFileSync } = require("child_process");

execFileSync(
  process.execPath,
  [
    path.join(__dirname, "test-glitch-prod-simple-runtime-v141.cjs"),
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" }
);
