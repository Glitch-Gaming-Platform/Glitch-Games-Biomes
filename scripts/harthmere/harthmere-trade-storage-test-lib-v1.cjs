const fs = require("fs");
const path = require("path");

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function checkFactory() {
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

function hasAll(source, needles) {
  return needles.every((needle) => source.includes(needle));
}

module.exports = { read, exists, checkFactory, hasAll };
