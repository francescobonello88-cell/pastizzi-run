/* headless harness: real three.js, stubbed DOM + renderer, simulated riding */
const fs = require("fs");
const vm = require("vm");

function el(id) {
  const e = {
    id, style: {}, dataset: {}, children: [], textContent: "", innerHTML: "",
    className: "", classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, removeEventListener() {}, getContext() { return ctx2d(); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, getAttribute() { return null; }, setAttribute() {},
    focus() {}, blur() {}, onclick: null, value: "", disabled: false, hidden: false,
    width: 264, height: 264, parentElement: null
  };
  return e;
}
function ctx2d() {
  const noop = () => {};
  return new Proxy({}, {
    get(t, k) {
      if (k === "canvas") return { width: 256, height: 256 };
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop: noop });
      if (k === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === "measureText") return () => ({ width: 10 });
      return noop;
    },
    set() { return true; }
  });
}

const els = {};
function byId(id) { return (els[id] = els[id] || el(id)); }

const rafQueue = [];
global.window = global;
global.window.addEventListener = function () {};
global.window.removeEventListener = function () {};
global.window.innerWidth = 412;
global.window.innerHeight = 892;
global.window.devicePixelRatio = 2;
global.document = {
  getElementById: byId,
  createElement(tag) {
    const e = el(tag);
    if (tag === "canvas") { e.width = 256; e.height = 256; }
    return e;
  },
  addEventListener() {}, removeEventListener() {}, body: el("body")
};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.location = { search: "" };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
global.cancelAnimationFrame = () => {};
global.navigator = { userAgent: "node" };
global.setTimeout = setTimeout; global.clearTimeout = clearTimeout;

const THREE = require("./js/three.min.js");
global.THREE = THREE;

/* stub the renderer: everything the game touches, no GL */
THREE.WebGLRenderer = function () {
  return {
    domElement: el("canvas"), shadowMap: {}, info: { render: { calls: 0, triangles: 0 } },
    setPixelRatio() {}, setSize() {}, render() { this.info.render.calls++; },
    outputEncoding: 0, capabilities: { getMaxAnisotropy: () => 1 }
  };
};

const code = fs.readFileSync("js/game.js", "utf8");
let err = null;
try { vm.runInThisContext(code, { filename: "game.js" }); }
catch (e) { err = e; }

const out = [];
console.log("boot error: " + (err ? (err.message + "\n" + String(err.stack).split("\n").slice(0,4).join("\n")) : "none"));

/* drive the loop */
function step(ms, label) {
  const cb = rafQueue.shift();
  if (!cb) { out.push(label + ": NO FRAME CALLBACK"); return false; }
  try { cb(ms); return true; }
  catch (e) { console.log(label + ": THREW " + e.message + "\n" + String(e.stack).split("\n").slice(1,5).join("\n")); return false; }
}

/* idle frames before starting */
const T0 = performance.now();
for (let i = 0; i < 5; i++) step(T0 + i * 16, "idle" + i);

/* start the game the way the button does */
try {
  const btn = els["startBtn"];
  if (btn && btn.onclick) btn.onclick(); else out.push("start button not wired");
} catch (e) { out.push("startGame threw: " + e.message); }

for (let i = 0; i < 200; i++) {
  if (!step(T0 + 100 + i * 16.7, "frame" + i)) break;
}
console.log("frames queued after run: " + rafQueue.length);
console.log("HUD speed=" + byId("speed").textContent + " picked=" + byId("picked").textContent + " time=" + byId("time").textContent);
console.log("dist=" + byId("distTxt").textContent + " stage=" + byId("stageName").textContent);
console.log("toast=" + JSON.stringify(byId("toast").textContent));
console.log(out.join("\n"));
