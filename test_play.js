/* autopilot playthrough: proves pickups, goal, rounds and game over */
const fs = require("fs"), vm = require("vm");
const H = require("./test_harness_lib.js");
const env = H.boot("js/game.js");
const els = env.els, step = env.step, rafQueue = env.rafQueue;
const T0 = env.now();
step(T0, "idle");
els["startBtn"].onclick();

let maxPicked = 0, goalSeen = 0, maxRound = 1, frames = 0, thrown = [];
let minGoalDist = 1e9, goalAtTime = null;
for (let i = 0; i < 12000; i++) {
  const P = global.window.__pastizzi;
  if (!P) break;
  // autopilot: follow the road, drift toward pickups that are close
  const road = P.road;
  let k = 0, kd = Infinity;
  for (let ri = 0; ri < road.length - 1; ri++) {
    const d = Math.hypot(road[ri].x - P.player.pos.x, road[ri].z - P.player.pos.z);
    if (d < kd) { kd = d; k = ri; }
  }
  let aim = { x: road[(k + 9) % (road.length - 1)].x, z: road[(k + 9) % (road.length - 1)].z };
  const near = P.pickups().filter(p => !p.got)
    .map(p => ({ p, d: Math.hypot(p.x - P.player.pos.x, p.z - P.player.pos.z) }))
    .sort((a, b) => a.d - b.d)[0];
  if (near && near.d < 28) aim = { x: near.p.x, z: near.p.z };
  if (P.game.goalActive && P.goalPos()) {
    const gd = Math.hypot(P.goalPos().x - P.player.pos.x, P.goalPos().z - P.player.pos.z);
    if (gd < 40) aim = { x: P.goalPos().x, z: P.goalPos().z };
  }
  if (P.game.running) {
    const want = Math.atan2(aim.x - P.player.pos.x, aim.z - P.player.pos.z);
    let err = want - P.player.heading;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    P.player.steer = Math.max(-1, Math.min(1, err * 2.2));
  }
  if (false) {
    const P2 = global.window.__pastizzi;
    if (P2.hits(P2.player.pos.x, P2.player.pos.z, 0.8)) {
      const px = P2.player.pos.x, pz = P2.player.pos.z;
      const bad = P2.colliders.filter(c => {
        const dx = px - c.x, dz = pz - c.z;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        return Math.abs(lx) < c.hw + 0.8 && Math.abs(lz) < c.hd + 0.8;
      });
      if (bad.length) {
        console.log("BLOCKED by", bad.length, "collider(s):", JSON.stringify(bad.map(c => ({
          x: +c.x.toFixed(1), z: +c.z.toFixed(1), hw: +c.hw.toFixed(1), hd: +c.hd.toFixed(1), rot: +(Math.atan2(c.sin, c.cos)).toFixed(2)
        }))));
        break;
      }
    }
  }
  if (i % 500 === 0) {
    console.log("  t=" + (i*16.7/1000).toFixed(0) + "s roadIdx=" + k +
      " pos=" + P.player.pos.x.toFixed(0) + "," + P.player.pos.z.toFixed(0) +
      " hdg=" + P.player.heading.toFixed(2) + " spd=" + P.player.speed.toFixed(1) +
      " picked=" + P.game.picked + (P.goalPos() ? " goalDist=" + Math.hypot(P.goalPos().x-P.player.pos.x, P.goalPos().z-P.player.pos.z).toFixed(0) : ""));
  }
  if (P.game.goalActive) {
    if (!goalSeen) goalAtTime = P.game.time;
    goalSeen = 1;
    if (P.goalPos()) {
      const gd = Math.hypot(P.goalPos().x - P.player.pos.x, P.goalPos().z - P.player.pos.z);
      if (gd < minGoalDist) minGoalDist = gd;
    }
  }
  maxPicked = Math.max(maxPicked, P.game.picked);
  maxRound = Math.max(maxRound, P.game.round);

  try { step(T0 + 100 + i * 16.7, "f" + i); }
  catch (e) { console.log("THREW at frame " + i + ": " + e.message); console.log(String(e.stack).split("\n").slice(1,5).join("\n")); thrown.push(i); break; }
  frames++;
}

const P = global.window.__pastizzi;
console.log("frames simulated :", frames);
console.log("distance ridden  :", (global.window.__pastizzi.player.distance||0).toFixed(0), "m");
console.log("toasts seen      :", global.window.__seenToast && global.window.__seenToast());
console.log("start/end pos    :", P.player.pos.x.toFixed(0)+","+P.player.pos.z.toFixed(0));
console.log("pickups left     :", P.pickups().filter(p=>!p.got).map(p=>Math.round(Math.hypot(p.x-P.player.pos.x,p.z-P.player.pos.z))).join(", "));
console.log("max picked       :", maxPicked, "/ 6");
console.log("goal activated   :", !!goalSeen);
console.log("best round seen  :", maxRound);
console.log("goal activated at:", goalAtTime == null ? "never" : goalAtTime.toFixed(1) + "s left");
console.log("closest to goal  :", minGoalDist === 1e9 ? "n/a" : minGoalDist.toFixed(1) + " m");
console.log("running at end   :", P ? P.game.running : "n/a");
console.log("timer at end     :", P ? P.game.time.toFixed(1) : "n/a");
console.log("loops thrown at  :", thrown.length ? thrown : "none");
console.log("overlay text     :", (els["center"] && els["center"].innerHTML || "").slice(0, 60) || "(empty)");
