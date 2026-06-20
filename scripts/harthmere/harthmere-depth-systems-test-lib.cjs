const fs = require("fs");
const path = require("path");

function read(root, rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function makeCheck() {
  let ok = true;
  function check(label, condition) {
    if (condition) {
      console.log(`OK ${label}`);
    } else {
      ok = false;
      console.log(`FAIL ${label}`);
    }
  }
  function finish() {
    console.log("");
    if (!ok) {
      console.log("RESULT: FAIL");
      process.exit(1);
    }
    console.log("RESULT: PASS");
  }
  return { check, finish };
}

function hasAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

module.exports = { read, makeCheck, hasAll };
