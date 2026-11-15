const H = require("./test_harness_lib.js");
const env = H.boot("js/game.js");
env.step(env.now(), "idle");
const P = global.window.__pastizzi;

function nearestRoadDist(x, z) {
  let best = 1e9;
  for (const p of P.road) best = Math.min(best, Math.hypot(p.x - x, p.z - z));
  return best;
}

console.log("road samples      :", P.road.length);
console.log("colliders         :", P.colliders.length);
console.log("cars              :", P.cars.length);
console.log("start on road     :", nearestRoadDist(P.player.pos.x, P.player.pos.z).toFixed(2) + " m from centreline");
console.log("start free of walls:", !P.hits(P.player.pos.x, P.player.pos.z, 0.55));

env.els["startBtn"].onclick();
const picks = P.pickups();
const offs = picks.map(p => +nearestRoadDist(p.x, p.z).toFixed(2));
const blocked = picks.filter(p => P.hits(p.x, p.z, 0.4)).length;
console.log("pickups spawned   :", picks.length);
console.log("pickup offsets    :", offs.join(", "));
console.log("pickups in walls  :", blocked);
console.log("max pickup offset :", Math.max(...offs).toFixed(2), "m (road half = 7.5)");

/* push the rider through 400 frames and confirm it actually moves */
const start = { x: P.player.pos.x, z: P.player.pos.z };
for (let i = 0; i < 400; i++) {
  P.player.steer = 0.15;
  env.step(env.now() + 100 + i * 16.7, "f");
}
const moved = Math.hypot(P.player.pos.x - start.x, P.player.pos.z - start.z);
console.log("moved in 6.7s     :", moved.toFixed(1) + " m");
console.log("speed now         :", (P.player.speed * 3.6).toFixed(0) + " km/h");
