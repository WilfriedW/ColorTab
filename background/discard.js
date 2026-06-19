// Domaines à ne JAMAIS mettre en veille (visio / mail web qui doivent rester
// vivants : notifications, appels…). Comparaison par suffixe → sous-domaines
// inclus.
export const NEVER_SLEEP_HOSTS = [
  "teams.microsoft.com",
  "teams.live.com",
  "teams.cloud.microsoft",
  "outlook.office.com",
  "outlook.office365.com",
  "outlook.live.com",
];

// Vrai si l'URL appartient à un domaine protégé (ou un de ses sous-domaines).
export function isNeverSleepHost(url, hosts = NEVER_SLEEP_HOSTS) {
  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return hosts.some((h) => hostname === h || hostname.endsWith("." + h));
}

// Décide si un onglet doit être mis en veille.
// Pure : aucune dépendance à l'API Chrome, donc testable hors navigateur.
export function shouldDiscard(tab, now, thresholdMs) {
  if (!tab) return false;
  if (tab.active) return false; // onglet actif de sa fenêtre
  if (tab.pinned) return false; // épinglé
  if (tab.discarded) return false; // déjà en veille
  if (typeof tab.lastAccessed !== "number") return false; // info absente → on ne touche pas
  if (isNeverSleepHost(tab.url)) return false; // Teams / Outlook → jamais
  return now - tab.lastAccessed >= thresholdMs;
}
