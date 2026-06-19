// Décide si un onglet doit être mis en veille.
// Pure : aucune dépendance à l'API Chrome, donc testable hors navigateur.
export function shouldDiscard(tab, now, thresholdMs) {
  if (!tab) return false;
  if (tab.active) return false; // onglet actif de sa fenêtre
  if (tab.pinned) return false; // épinglé
  if (tab.discarded) return false; // déjà en veille
  if (typeof tab.lastAccessed !== "number") return false; // info absente → on ne touche pas
  return now - tab.lastAccessed >= thresholdMs;
}
