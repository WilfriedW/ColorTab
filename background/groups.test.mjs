import assert from "node:assert";
import { planGroupMerges } from "./groups.js";

const ours = ["Shared QA", "Corp Prod"];

// Doublons dans la même fenêtre → on garde le premier, on fusionne les autres
assert.deepStrictEqual(
  planGroupMerges(
    [
      { id: 1, title: "Shared QA", windowId: 10 },
      { id: 2, title: "Shared QA", windowId: 10 },
      { id: 3, title: "Shared QA", windowId: 10 },
      { id: 4, title: "Corp Prod", windowId: 10 },
    ],
    ours
  ),
  [{ keepId: 1, mergeIds: [2, 3] }]
);

// Même titre mais fenêtres différentes → PAS de fusion (groupes par fenêtre)
assert.deepStrictEqual(
  planGroupMerges(
    [
      { id: 1, title: "Shared QA", windowId: 10 },
      { id: 2, title: "Shared QA", windowId: 20 },
    ],
    ours
  ),
  []
);

// Titre qui n'est pas à nous → ignoré (on ne touche pas aux groupes perso)
assert.deepStrictEqual(
  planGroupMerges(
    [
      { id: 1, title: "Perso", windowId: 10 },
      { id: 2, title: "Perso", windowId: 10 },
    ],
    ours
  ),
  []
);

// Accepte aussi un Set comme liste de titres
assert.deepStrictEqual(
  planGroupMerges(
    [
      { id: 5, title: "Corp Prod", windowId: 1 },
      { id: 6, title: "Corp Prod", windowId: 1 },
    ],
    new Set(ours)
  ),
  [{ keepId: 5, mergeIds: [6] }]
);

// Un seul groupe par (fenêtre, titre) → rien à faire
assert.deepStrictEqual(
  planGroupMerges([{ id: 1, title: "Shared QA", windowId: 10 }], ours),
  []
);

console.log("groups.test.mjs OK");
