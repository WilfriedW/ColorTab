import assert from "node:assert";
import { shouldDiscard, isNeverSleepHost } from "./discard.js";

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

// --- Exception Teams / Outlook : jamais mis en veille même si vieux ---
assert.strictEqual(
  shouldDiscard({ ...base, url: "https://teams.microsoft.com/_#/conversations" }, NOW, SEUIL),
  false
);
assert.strictEqual(
  shouldDiscard({ ...base, url: "https://outlook.office.com/mail/0/" }, NOW, SEUIL),
  false
);

// isNeverSleepHost : Teams / Outlook (et sous-domaines) protégés
assert.strictEqual(isNeverSleepHost("https://teams.microsoft.com/"), true);
assert.strictEqual(isNeverSleepHost("https://outlook.office365.com/owa/"), true);
assert.strictEqual(isNeverSleepHost("https://outlook.live.com/mail/"), true);
assert.strictEqual(isNeverSleepHost("https://sub.outlook.office.com/x"), true);

// isNeverSleepHost : domaines normaux non protégés
assert.strictEqual(isNeverSleepHost("https://www.google.com"), false);
assert.strictEqual(isNeverSleepHost("https://dev.service-now.com"), false);
// Pas de faux positif sur un domaine qui contient juste le mot
assert.strictEqual(isNeverSleepHost("https://teams.microsoft.com.evil.com"), false);

// URL invalide / absente → non protégé (et donc géré par les autres règles)
assert.strictEqual(isNeverSleepHost(undefined), false);
assert.strictEqual(isNeverSleepHost("pas une url"), false);

console.log("discard.test.mjs OK");
