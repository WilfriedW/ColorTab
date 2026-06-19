# ColorTab — Coloration de l'onglet (favicon + groupes natifs) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marquer l'onglet Chrome dans la barre d'onglets avec la couleur de la règle, via un favicon-pastille (couleur exacte, toujours actif) et un groupement natif optionnel.

**Architecture:** Le content script génère un favicon coloré à la réception de `APPLY_COLOR` et le ré-applique sur SPA. Le service worker groupe les onglets matchés (derrière le réglage `groupTabs`) en mappant la couleur hex vers la couleur Chrome la plus proche. Un nouvel interrupteur dans le popup pilote `groupTabs`.

**Tech Stack:** Chrome Extension MV3, JavaScript (modules ES pour le service worker), API `chrome.tabs` / `chrome.tabGroups` / `chrome.storage.sync`, `<canvas>` pour le favicon.

> **Note dépôt :** le projet n'est PAS un dépôt git. Les étapes « Commit » sont remplacées par un **checkpoint de vérification manuelle**. Si tu veux des commits, lance d'abord `git init` à la racine.

> **Note tests :** pas de framework de test installé. Seule la logique pure (mapping de couleur) est testée via `node`. Le reste (DOM, API Chrome) se vérifie manuellement dans Chrome — chaque tâche concernée a un checkpoint explicite.

---

### Task 1 : Module de couleurs + test (logique pure, TDD)

**Files:**
- Create: `package.json`
- Create: `background/colors.js`
- Test: `background/colors.test.mjs`

- [ ] **Step 1 : Créer `package.json` pour que node lise les `.js` comme modules ES**

```json
{
  "name": "colortab",
  "private": true,
  "type": "module"
}
```

(Le navigateur ignore `package.json` ; ceci n'affecte que l'exécution node des tests.)

- [ ] **Step 2 : Écrire le test qui échoue**

`background/colors.test.mjs` :

```js
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
```

- [ ] **Step 3 : Lancer le test, vérifier l'échec**

Run: `node background/colors.test.mjs`
Expected: FAIL — `Cannot find module './colors.js'` (le fichier n'existe pas encore).

- [ ] **Step 4 : Implémenter `background/colors.js`**

```js
// Valeurs RGB de référence des 8 couleurs natives de groupes Chrome.
export const CHROME_GROUP_COLORS = {
  grey: [95, 99, 104],
  blue: [26, 115, 232],
  red: [217, 48, 37],
  yellow: [249, 171, 0],
  green: [24, 128, 56],
  pink: [208, 24, 132],
  purple: [161, 66, 244],
  cyan: [0, 123, 131],
  orange: [250, 144, 62],
};

export function hexToRgb(hex) {
  const m = String(hex)
    .replace("#", "")
    .match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export function nearestChromeGroupColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "grey";
  let best = "grey";
  let bestDist = Infinity;
  for (const [name, c] of Object.entries(CHROME_GROUP_COLORS)) {
    const d =
      (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}
```

- [ ] **Step 5 : Lancer le test, vérifier le succès**

Run: `node background/colors.test.mjs`
Expected: PASS — affiche `colors.test.mjs OK`, code de sortie 0.

- [ ] **Step 6 : Checkpoint** — `node background/colors.test.mjs` passe.

---

### Task 2 : Déclarer le service worker en module ES + permission `tabGroups`

**Files:**
- Modify: `manifest.json:6-10` (permissions)
- Modify: `manifest.json:32-34` (background)

- [ ] **Step 1 : Ajouter la permission `tabGroups`**

Dans `manifest.json`, remplacer le bloc `permissions` :

```json
  "permissions": [
    "activeTab",
    "storage",
    "tabs",
    "tabGroups"
  ],
```

- [ ] **Step 2 : Déclarer le service worker comme module ES**

Dans `manifest.json`, remplacer le bloc `background` :

```json
  "background": {
    "service_worker": "background/background.js",
    "type": "module"
  }
```

- [ ] **Step 3 : Checkpoint** — `chrome://extensions` → recharger l'extension → aucune erreur rouge sur la carte ColorTab (le service worker se charge bien en module).

---

### Task 3 : Favicon coloré dans le content script (Feature A)

**Files:**
- Modify: `content/content.js` (ajouts en tête + intégration dans `applyColor`)

- [ ] **Step 1 : Ajouter l'état et les helpers favicon en tête de `content/content.js`**

Juste après la ligne `let fadeTimeout = null;` :

```js
let activeColor = null;
let originalFavicon = undefined; // undefined = pas encore capturé
let faviconObserver = null;

function captureOriginalFavicon() {
  if (originalFavicon !== undefined) return;
  const link = document.querySelector("link[rel~='icon']");
  originalFavicon = link ? link.href : null;
}

function makeFaviconDataUrl(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  return canvas.toDataURL("image/png");
}

function setColorFavicon(color) {
  captureOriginalFavicon();
  document
    .querySelectorAll("link[rel~='icon']:not(#colortab-favicon)")
    .forEach((el) => el.remove());
  let link = document.getElementById("colortab-favicon");
  if (!link) {
    link = document.createElement("link");
    link.id = "colortab-favicon";
    link.rel = "icon";
    (document.head || document.documentElement).appendChild(link);
  }
  link.href = makeFaviconDataUrl(color);
}

function restoreFavicon() {
  const our = document.getElementById("colortab-favicon");
  if (our) our.remove();
  if (originalFavicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      (document.head || document.documentElement).appendChild(link);
    }
    link.href = originalFavicon;
  }
}
```

- [ ] **Step 2 : Intégrer le favicon dans `applyColor`**

Dans `content/content.js`, fonction `applyColor(color, label)`, après `ensureElements();` ajouter la branche favicon. Le bloc `if (!color)` devient :

```js
function applyColor(color, label) {
  ensureElements();

  if (!color) {
    activeColor = null;
    restoreFavicon();
    for (const side of SIDES) {
      if (borders[side]) borders[side].style.backgroundColor = "transparent";
    }
    if (badge) {
      badge.style.opacity = "0";
      badge.textContent = "";
    }
    return;
  }

  activeColor = color;
  setColorFavicon(color);
  startFaviconObserver();

  for (const side of SIDES) {
    if (borders[side]) borders[side].style.setProperty("background-color", color, "important");
  }

  if (label && badge) {
    badge.style.setProperty("background-color", color, "important");
    badge.textContent = label;
    badge.style.setProperty("opacity", "1", "important");

    clearTimeout(fadeTimeout);
    fadeTimeout = setTimeout(() => {
      badge.style.setProperty("opacity", "0", "important");
    }, 3000);
  }
}
```

(`startFaviconObserver` est défini à la Task 4 ; on l'appelle ici dès maintenant.)

- [ ] **Step 3 : Checkpoint partiel (sans observer, sera complété Task 4)** — ne pas tester isolément ; passer à la Task 4 qui ajoute `startFaviconObserver` puis vérifier.

---

### Task 4 : Ré-application du favicon sur SPA (Feature A, suite)

**Files:**
- Modify: `content/content.js` (ajouter `startFaviconObserver`)

- [ ] **Step 1 : Ajouter `startFaviconObserver` dans `content/content.js`**

À placer juste après `restoreFavicon()` :

```js
function startFaviconObserver() {
  if (faviconObserver) return;
  faviconObserver = new MutationObserver(() => {
    if (!activeColor) return;
    const our = document.getElementById("colortab-favicon");
    const others = document.querySelectorAll(
      "link[rel~='icon']:not(#colortab-favicon)"
    );
    // Le site a réinjecté son icône ou supprimé la nôtre → on ré-applique.
    if (!our || others.length > 0) {
      setColorFavicon(activeColor);
    }
  });
  const target = document.head || document.documentElement;
  faviconObserver.observe(target, { childList: true, subtree: true });
}
```

- [ ] **Step 2 : Checkpoint manuel dans Chrome**

1. `chrome://extensions` → recharger ColorTab.
2. Ouvrir/recharger un onglet `*.service-now.com`.
3. Attendu : l'icône de l'onglet devient une **pastille orange** (couleur de la règle par défaut) dans la barre d'onglets.
4. Naviguer en interne (ouvrir un autre formulaire/enregistrement ServiceNow) → la pastille **reste** (l'observer la ré-applique).
5. Aller sur un domaine sans règle (ex. `https://example.com`) → l'icône d'origine **revient**.

Si la pastille clignote en boucle : vérifier que `setColorFavicon` ne déclenche pas l'observer indéfiniment (il doit converger : après ré-application, `others.length === 0` et notre lien existe → plus d'action).

---

### Task 5 : Lecture des réglages + helpers de groupe dans le background

**Files:**
- Modify: `background/background.js` (import, `getSettings`, helpers de groupe)

- [ ] **Step 1 : Importer le module de couleurs en tête de `background/background.js`**

Tout en haut du fichier (avant `const DEFAULT_RULES`) :

```js
import { nearestChromeGroupColor } from "./colors.js";
```

- [ ] **Step 2 : Ajouter `getSettings` et les helpers de groupe**

À ajouter à la fin de `background/background.js` :

```js
async function getSettings() {
  const { rules, groupTabs } = await chrome.storage.sync.get([
    "rules",
    "groupTabs",
  ]);
  return { rules: rules || [], groupTabs: !!groupTabs };
}

function groupTitleFor(rule) {
  return rule.label || rule.pattern;
}

async function isOurGroup(groupId, rules) {
  if (groupId === undefined || groupId === -1) return false;
  try {
    const g = await chrome.tabGroups.get(groupId);
    const titles = new Set(rules.map(groupTitleFor));
    return titles.has(g.title);
  } catch {
    return false;
  }
}

async function updateTabGroup(tab, match, groupTabs, rules) {
  try {
    if (groupTabs && match) {
      const title = groupTitleFor(match);
      const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
      const existing = groups.find((g) => g.title === title);
      if (existing) {
        if (tab.groupId !== existing.id) {
          await chrome.tabs.group({ groupId: existing.id, tabIds: tab.id });
        }
      } else {
        const groupId = await chrome.tabs.group({ tabIds: tab.id });
        await chrome.tabGroups.update(groupId, {
          title,
          color: nearestChromeGroupColor(match.color),
        });
      }
    } else if (await isOurGroup(tab.groupId, rules)) {
      // L'onglet ne matche plus (ou groupement désactivé) et il est dans un de
      // NOS groupes → on le sort. On ne touche jamais aux groupes de l'utilisateur.
      await chrome.tabs.ungroup(tab.id);
    }
  } catch {
    // Onglet en cours de fermeture/déplacement → ignorer.
  }
}

async function ungroupAllOurGroups(rules) {
  const titles = new Set(rules.map(groupTitleFor));
  try {
    const groups = await chrome.tabGroups.query({});
    for (const g of groups) {
      if (titles.has(g.title)) {
        const tabs = await chrome.tabs.query({ groupId: g.id });
        if (tabs.length) {
          await chrome.tabs.ungroup(tabs.map((t) => t.id));
        }
      }
    }
  } catch {
    // ignorer
  }
}
```

- [ ] **Step 3 : Checkpoint** — recharger l'extension ; aucune erreur dans la console du service worker (les fonctions ne sont pas encore appelées, on valide juste que l'import et la syntaxe passent).

---

### Task 6 : Brancher le groupement dans le flux d'application

**Files:**
- Modify: `background/background.js` (`applyColorToTab`, `storage.onChanged`)

- [ ] **Step 1 : Remplacer `applyColorToTab` pour utiliser `getSettings` et grouper**

Remplacer la fonction `applyColorToTab` existante par :

```js
async function applyColorToTab(tabId, url) {
  if (!url) return;

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return;
  }

  const { rules, groupTabs } = await getSettings();
  const match = findMatchingRule(hostname, rules);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "APPLY_COLOR",
      color: match ? match.color : null,
      label: match ? match.label : null,
    });
  } catch {
    // Content script pas encore chargé, ignorer.
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    await updateTabGroup(tab, match, groupTabs, rules);
  } catch {
    // Onglet inaccessible, ignorer.
  }
}
```

- [ ] **Step 2 : Gérer le changement de `groupTabs` dans `storage.onChanged`**

Remplacer le listener `chrome.storage.onChanged` existant par :

```js
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.groupTabs && changes.groupTabs.newValue === false) {
    const { rules } = await getSettings();
    await ungroupAllOurGroups(rules);
  }

  if (changes.rules || changes.groupTabs) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) {
        await applyColorToTab(tab.id, tab.url);
      }
    }
  }
});
```

- [ ] **Step 3 : Checkpoint manuel dans Chrome**

1. Recharger ColorTab + recharger un onglet `*.service-now.com`.
2. Ouvrir la console du service worker (`chrome://extensions` → « service worker ») : pas d'erreur rouge.
3. (Le toggle n'existe pas encore — il sera testé Task 7. Pour un test temporaire, dans la console du service worker : `chrome.storage.sync.set({ groupTabs: true })` puis recharger l'onglet ServiceNow → l'onglet doit rejoindre un groupe coloré nommé d'après le label de la règle.)
4. `chrome.storage.sync.set({ groupTabs: false })` → les onglets de nos groupes sont dégroupés.

---

### Task 7 : Interrupteur « Grouper les onglets » dans le popup

**Files:**
- Modify: `popup/popup.html` (case à cocher)
- Modify: `popup/popup.js` (lecture/écriture du réglage)
- Modify: `popup/popup.css` (style de la ligne d'option)

- [ ] **Step 1 : Ajouter la case à cocher dans `popup/popup.html`**

Juste après le bouton `add-rule` (ligne `<button id="add-rule" ...>`), avant le bloc `<div class="help">` :

```html
  <label class="option-row">
    <input type="checkbox" id="group-tabs">
    <span>Grouper les onglets par règle</span>
  </label>
```

- [ ] **Step 2 : Lire/écrire `groupTabs` dans `popup/popup.js`**

Dans `popup/popup.js`, remplacer la fonction `init` par :

```js
async function init() {
  await renderRules();
  document.getElementById("add-rule").addEventListener("click", addRule);

  const groupToggle = document.getElementById("group-tabs");
  const { groupTabs } = await chrome.storage.sync.get("groupTabs");
  groupToggle.checked = !!groupTabs;
  groupToggle.addEventListener("change", async (e) => {
    await chrome.storage.sync.set({ groupTabs: e.target.checked });
  });
}
```

- [ ] **Step 3 : Styler la ligne d'option dans `popup/popup.css`**

Ajouter à la fin de `popup/popup.css` :

```css
.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.option-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
```

- [ ] **Step 4 : Checkpoint manuel dans Chrome (vérification de bout en bout)**

1. Recharger ColorTab. Ouvrir le popup → la case « Grouper les onglets par règle » est présente et **décochée**.
2. Ouvrir 2 onglets `*.service-now.com` → chacun a une **pastille orange** (favicon, Feature A).
3. **Cocher** la case → les 2 onglets se **regroupent** dans un groupe Chrome coloré (orange/yellow le plus proche), nommé d'après le label de la règle. (Les onglets se déplacent pour se coller — comportement natif attendu.)
4. **Décocher** → les onglets sont **dégroupés**, la pastille reste.
5. Naviguer un de ces onglets vers `https://example.com` → pastille d'origine restaurée, et (si groupé) retiré du groupe.
6. Fermer/rouvrir Chrome ou attendre la mise en veille du service worker, rouvrir un onglet ServiceNow avec le toggle actif → toujours groupé (résolution par requête de l'état réel, pas d'état mémoire).

---

## Auto-revue du plan

**Couverture de la spec :**
- Feature A favicon (couleur exacte, remplacement) → Task 3. ✅
- Ré-application SPA + restauration d'origine → Task 4 (et `restoreFavicon` Task 3). ✅
- Feature C groupes natifs + mapping couleur → Tasks 1, 5, 6. ✅
- Réglage `groupTabs` défaut `false` + toggle popup → Tasks 6, 7. ✅
- Dégroupement au décochage / au changement de domaine, sans toucher aux groupes utilisateur → `isOurGroup` / `ungroupAllOurGroups` (Tasks 5, 6). ✅
- Permission `tabGroups` + service worker module → Task 2. ✅
- Liseré + moteur de règles inchangés → non modifiés. ✅

**Scan placeholders :** aucun TBD/TODO ; tout le code est complet.

**Cohérence des types :** `groupTitleFor`, `nearestChromeGroupColor`, `setColorFavicon`, `startFaviconObserver`, `activeColor`, `getSettings`, `updateTabGroup` sont définis avant usage et nommés de façon cohérente entre tâches.
