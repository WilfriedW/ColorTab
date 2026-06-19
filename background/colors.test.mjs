import assert from "node:assert";
import { nearestChromeGroupColor, hexToRgb } from "./colors.js";

assert.deepStrictEqual(hexToRgb("#FF8C00"), [255, 140, 0]);
assert.strictEqual(hexToRgb("bad"), null);

// Couleurs égales aux références Chrome → mapping non ambigu
assert.strictEqual(nearestChromeGroupColor("#1a73e8"), "blue");
assert.strictEqual(nearestChromeGroupColor("#188038"), "green");
assert.strictEqual(nearestChromeGroupColor("#d93025"), "red");
assert.strictEqual(nearestChromeGroupColor("#fa903e"), "orange");
assert.strictEqual(nearestChromeGroupColor("#a142f4"), "purple");

// Entrée invalide → grey par défaut
assert.strictEqual(nearestChromeGroupColor("nope"), "grey");

console.log("colors.test.mjs OK");
