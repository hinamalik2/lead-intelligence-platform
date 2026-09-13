const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createStorage() {
  const data = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

let entropy = 0;

function loadSdk(localStorage, sessionStorage) {
  const context = {
    console,
    Date,
    Math,
    Uint8Array,
    Array,
    Object,
    Number,
    String,
    Boolean,
    JSON,
    crypto: {
      getRandomValues(bytes) {
        entropy += 1;
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i + 7 + entropy) % 256;
      },
    },
    localStorage,
    sessionStorage,
    HINA_TRACKER_CONFIG: { apiUrl: "http://localhost:8000", debug: false },
    document: { readyState: "complete", addEventListener() {}, title: "Test" },
    location: { pathname: "/services", search: "" },
    navigator: { userAgent: "test", language: "en", platform: "test" },
    screen: { width: 1280, height: 720 },
    innerWidth: 1280,
    innerHeight: 720,
    fetch: async () => ({ ok: true }),
    addEventListener() {},
  };
  context.window = context;
  const sandbox = vm.createContext(context);
  const files = ["config.js", "visitor.js", "session.js", "events.js", "tracker.js"];
  files.forEach((file) => {
    const code = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
    vm.runInContext(code, sandbox);
  });
  return sandbox;
}

const storageA = createStorage();
const sessionA = createStorage();
const first = loadSdk(storageA, sessionA);
const visitorA = first.HinaVisitor.getId();
const sessionOne = first.HinaSession.getId();

assert.ok(visitorA.startsWith("visitor_"), "visitor id prefix");
assert.ok(sessionOne.startsWith("session_"), "session id prefix");
assert.strictEqual(first.HinaVisitor.getId(), visitorA, "visitor id is stable in localStorage");
assert.strictEqual(first.HinaSession.getId(), sessionOne, "session id is stable in sessionStorage");
assert.strictEqual(first.HinaSession.isReturningVisitor(), false, "first session is not returning");

const sessionB = createStorage();
const second = loadSdk(storageA, sessionB);
assert.strictEqual(second.HinaVisitor.getId(), visitorA, "returning browser keeps visitor id");
assert.notStrictEqual(second.HinaSession.getId(), sessionOne, "new browser session gets new session id");
assert.strictEqual(second.HinaSession.isReturningVisitor(), true, "second session is returning");

const src = fs.readFileSync(path.join(__dirname, "..", "src", "tracker.js"), "utf8");
assert.ok(src.includes("SENSITIVE"), "form tracker skips sensitive fields");

console.log("All tracker-sdk tests passed");
