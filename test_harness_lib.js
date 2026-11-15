/* shared stub environment for headless runs */
const fs = require("fs"), vm = require("vm");

function ctx2d() {
  const noop = () => {};
  return new Proxy({}, {
    get(t, k) {
      if (k === "canvas") return { width: 256, height: 256 };
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop: noop });
      if (k === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      if (k === "measureText") return () => ({ width: 10 });
      return noop;
    },
    set() { return true; }
  });
}
function mkEl(id) {
  return {
    id, style: {}, dataset: {}, children: [], textContent: "", innerHTML: "", className: "",
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, removeEventListener() {}, getContext() { return ctx2d(); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, getAttribute() { return null; }, setAttribute() {},
    width: 264, height: 264, value: "", disabled: false, hidden: false, onclick: null
  };
}

function boot(gameFile) {
  const els = {};
  const byId = id => (els[id] = els[id] || mkEl(id));
  const rafQueue = [];

  global.window = global;
  global.window.addEventListener = () => {};
  global.window.removeEventListener = () => {};
  global.window.innerWidth = 412; global.window.innerHeight = 892; global.window.devicePixelRatio = 2;
  global.document = {
    getElementById: byId,
    createElement: t => { const e = mkEl(t); if (t === "canvas") { e.width = 256; e.height = 256; } return e; },
    addEventListener() {}, removeEventListener() {}, body: mkEl("body")
  };
  global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  global.location = { search: "?debug=1" };
  const start = Date.now();
  global.performance = { now: () => start };
  global.requestAnimationFrame = cb => { rafQueue.push(cb); return rafQueue.length; };
  global.cancelAnimationFrame = () => {};
  global.navigator = { userAgent: "node" };

  const THREE = require("./js/three.min.js");
  global.THREE = THREE;
  THREE.WebGLRenderer = function () {
    return {
      domElement: mkEl("canvas"), shadowMap: {}, info: { render: { calls: 0, triangles: 0 } },
      setPixelRatio() {}, setSize() {}, render() { this.info.render.calls++; },
      outputEncoding: 0, capabilities: { getMaxAnisotropy: () => 1 }
    };
  };

  vm.runInThisContext(fs.readFileSync(gameFile, "utf8"), { filename: gameFile });

  function step(ms, label) {
    const cb = rafQueue.shift();
    if (!cb) throw new Error("no frame callback (" + label + ")");
    cb(ms);
  }
  return { els, rafQueue, step, now: () => start };
}
module.exports = { boot };
