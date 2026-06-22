// Calcule, par fenêtre, quels groupes en double fusionner.
// On ne considère que NOS groupes (titre = un label de règle). Pour chaque
// (fenêtre, titre) ayant plusieurs groupes, on garde le premier et on liste les
// autres à fusionner dedans.
// Pur : aucune dépendance à l'API Chrome, donc testable hors navigateur.
export function planGroupMerges(groups, ourTitles) {
  const titles = ourTitles instanceof Set ? ourTitles : new Set(ourTitles);
  const byKey = new Map();
  for (const g of groups) {
    if (!titles.has(g.title)) continue;
    const key = g.windowId + "\n" + g.title;
    const list = byKey.get(key) || [];
    list.push(g);
    byKey.set(key, list);
  }
  const plans = [];
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    plans.push({ keepId: list[0].id, mergeIds: list.slice(1).map((g) => g.id) });
  }
  return plans;
}
