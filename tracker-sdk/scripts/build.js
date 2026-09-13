const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src");
const distDir = path.join(__dirname, "..", "dist");
const files = ["config.js", "visitor.js", "session.js", "events.js", "tracker.js"];

const banner = `/*! Hina Tracking SDK — visitor/session/event tracker */\n`;
const bundle = banner + files.map((file) => fs.readFileSync(path.join(srcDir, file), "utf8")).join("\n");

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "tracker.js"), bundle);
console.log("Wrote tracker-sdk/dist/tracker.js");
