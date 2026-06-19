# ColorTab — Mise en veille automatique des onglets inactifs

**Date :** 2026-06-19
**Statut :** Design approuvé, prêt pour plan d'implémentation

## Contexte

ColorTab est une extension Chrome (MV3) qui colore les onglets par domaine pour
identifier des instances clients. L'utilisateur ouvre beaucoup d'onglets (de
nombreuses instances) et veut **libérer de la mémoire** automatiquement, en
acceptant qu'un onglet mis en veille mette un peu de temps à se rouvrir.

## Objectif

Mettre automatiquement en veille (`chrome.tabs.discard`) les onglets **non
utilisés depuis un délai configurable** (5 min par défaut). Un onglet en veille
est déchargé de la RAM mais reste dans la barre ; Chrome le recharge tout seul
au clic.

## Périmètre

### Inclus
- Mise en veille auto des onglets inactifs depuis ≥ `discardMinutes`.
- Détection de l'inactivité via `tab.lastAccessed` (fourni par Chrome).
- Vérification périodique via `chrome.alarms` (toutes les minutes).
- Exclusions : onglet actif de chaque fenêtre, onglets épinglés, onglets déjà en
  veille, onglets non « discardables » (échec ignoré).
- Portée : **tous** les onglets inactifs (pas seulement ceux qui matchent une
  règle ColorTab).
- Réglages popup : interrupteur on/off + menu déroulant du délai.
- Permission `alarms` dans le manifest.

### Exclus (YAGNI)
- Protection des onglets jouant du son (l'utilisateur a choisi de ne pas exclure).
- Protection des saisies de formulaire non enregistrées (choix utilisateur).
- Mise en veille ciblée par règle (portée = tous les onglets).
- Suivi maison d'un horodatage « dernier accès » (inutile : `tab.lastAccessed`).

## Architecture

Tout côté **service worker** (`background/background.js`), indépendant du moteur
de couleur existant. Une alarme périodique déclenche un balayage des onglets.

```
chrome.alarms ("colortab-discard", toutes les 1 min)
        │
        ▼
 onAlarm  ──►  getSettings()  ──►  autoDiscard ? ──► non ──► (rien)
                                        │ oui
                                        ▼
                          chrome.tabs.query({})  →  pour chaque onglet :
                            exclu ? (actif / épinglé / déjà en veille
                                     / lastAccessed absent / récent)  → skip
                            sinon  →  chrome.tabs.discard(id)  (try/catch)
```

## Réglages (chrome.storage.sync)

```jsonc
{
  "autoDiscard": true,   // nouveau, activé par défaut
  "discardMinutes": 5    // nouveau, défaut 5
}
```

Valeurs proposées dans le popup : 5, 10, 15, 30, 60 minutes.

## Mécanique détaillée

**Création de l'alarme.** L'alarme `colortab-discard` (period 1 min) est (re)créée
dans `chrome.runtime.onInstalled` et `chrome.runtime.onStartup`. `chrome.alarms.create`
est idempotent (remplace l'alarme de même nom).

**Balayage** (`onAlarm` pour l'alarme `colortab-discard`) :
1. Lire `autoDiscard` et `discardMinutes`. Si `autoDiscard` est faux → ne rien faire.
2. `seuil = discardMinutes * 60 * 1000`.
3. `now = Date.now()`.
4. `const tabs = await chrome.tabs.query({})`.
5. Pour chaque `tab`, **ignorer** si :
   - `tab.active` (onglet actif de sa fenêtre), ou
   - `tab.pinned`, ou
   - `tab.discarded` (déjà en veille), ou
   - `typeof tab.lastAccessed !== "number"` (sécurité si non fourni), ou
   - `now - tab.lastAccessed < seuil` (encore récent).
6. Sinon : `try { await chrome.tabs.discard(tab.id); } catch { /* page non discardable, onglet en transition → ignorer */ }`.

**Permission.** Ajouter `"alarms"` à `permissions`. `chrome.tabs.discard` ne
nécessite pas de permission supplémentaire (la permission `tabs` est déjà là).

## Popup

**Fichiers :** `popup/popup.html`, `popup/popup.js`, `popup/popup.css`

- Nouvelle ligne d'option : interrupteur **« Mettre en veille les onglets inactifs »**
  lié à `storage.sync.autoDiscard`.
- Menu déroulant **« après … »** lié à `storage.sync.discardMinutes`, options
  5/10/15/30/60. Le menu peut être affiché en permanence (désactivé visuellement
  si l'interrupteur est off, optionnel — non requis).
- Lecture des deux réglages au chargement (`init`), écriture à chaque changement.

## Gestion des erreurs / cas limites

- `chrome.tabs.discard` rejette sur les pages spéciales (`chrome://`, nouvel
  onglet, page en cours de déchargement) → enveloppé dans try/catch, ignoré.
- Si `tab.lastAccessed` est absent (Chrome ancien) → l'onglet n'est jamais mis en
  veille (dégradation silencieuse, pas de crash).
- Le délai effectif est compris entre `discardMinutes` et `discardMinutes + 1 min`
  (granularité de l'alarme).
- Désactiver l'interrupteur arrête immédiatement les futures mises en veille ; les
  onglets déjà en veille ne sont pas réveillés (Chrome s'en charge au clic).

## Tests / vérification manuelle

1. Activer l'option, régler à 5 min. Ouvrir plusieurs onglets, en laisser un de
   côté > 5 min → il passe en veille (icône grisée ; `chrome://discards` le
   confirme). Cliquer dessus → il se recharge.
2. Épingler un onglet inactif → il **n'est jamais** mis en veille.
3. L'onglet actif de chaque fenêtre **n'est jamais** mis en veille.
4. Désactiver l'interrupteur → plus aucune mise en veille.
5. Changer le délai à 10 min → comportement ajusté.
6. Vérifier qu'une page `chrome://` ne provoque pas d'erreur dans la console du
   service worker.
