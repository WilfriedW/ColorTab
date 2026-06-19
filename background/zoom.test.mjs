import assert from "node:assert";
import { nextPresentationZoom, PRESENTATION_ZOOM } from "./zoom.js";

// Constante = 150 %
assert.strictEqual(PRESENTATION_ZOOM, 1.5);

// Pas (encore) en présentation → on passe à 150 %
assert.strictEqual(nextPresentationZoom(1.0), 1.5);
assert.strictEqual(nextPresentationZoom(0.9), 1.5);
assert.strictEqual(nextPresentationZoom(1.25), 1.5);

// Déjà à ~150 % → retour à 100 %
assert.strictEqual(nextPresentationZoom(1.5), 1.0);
assert.strictEqual(nextPresentationZoom(1.45), 1.0); // pile au seuil
assert.strictEqual(nextPresentationZoom(2.0), 1.0);

console.log("zoom.test.mjs OK");
