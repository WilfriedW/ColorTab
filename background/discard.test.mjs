import assert from "node:assert";
import { shouldDiscard } from "./discard.js";

const NOW = 10_000_000;
const SEUIL = 5 * 60 * 1000; // 5 min
const vieux = NOW - SEUIL - 1; // dépasse le seuil
const recent = NOW - 1000; // < seuil

const base = { id: 1, active: false, pinned: false, discarded: false, lastAccessed: vieux };

// Cas nominal : inactif assez longtemps → mise en veille
assert.strictEqual(shouldDiscard(base, NOW, SEUIL), true);

// Onglet actif → jamais
assert.strictEqual(shouldDiscard({ ...base, active: true }, NOW, SEUIL), false);

// Onglet épinglé → jamais
assert.strictEqual(shouldDiscard({ ...base, pinned: true }, NOW, SEUIL), false);

// Déjà en veille → non
assert.strictEqual(shouldDiscard({ ...base, discarded: true }, NOW, SEUIL), false);

// Accédé récemment → non
assert.strictEqual(shouldDiscard({ ...base, lastAccessed: recent }, NOW, SEUIL), false);

// lastAccessed absent → non (sécurité)
assert.strictEqual(shouldDiscard({ ...base, lastAccessed: undefined }, NOW, SEUIL), false);

// Pile au seuil → mise en veille (>=)
assert.strictEqual(shouldDiscard({ ...base, lastAccessed: NOW - SEUIL }, NOW, SEUIL), true);

// tab nul → non
assert.strictEqual(shouldDiscard(null, NOW, SEUIL), false);

console.log("discard.test.mjs OK");
