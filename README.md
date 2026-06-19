# 🎨 ColorTab

> Repère d'un coup d'œil sur quelle instance client tu te trouves.

ColorTab colorise tes onglets Chrome **en fonction du domaine**. Quand tu ouvres
plein d'instances de plein de clients (ServiceNow & autres), tu vois
immédiatement **dans quel groupe** et **de quelle couleur** est l'onglet — fini
de cliquer dans la mauvaise instance « prod du client X ».

Chaque règle de domaine déclenche **quatre repères visuels** :

- 🟩 **une pastille colorée** sur l'icône de l'onglet (couleur exacte, visible même onglet inactif) ;
- 📏 **un liseré coloré** autour de la page ;
- 🏷️ **un badge** en haut à droite avec le nom de la règle (reste affiché) ;
- 🗂️ **un regroupement natif** des onglets par client (optionnel).

---

## ✨ Fonctionnalités

- **Règles par domaine** avec jokers (`*`) et correspondance « domaine + sous-domaines ».
- **Couleur exacte** pour la pastille / le liseré / le badge ; couleur aléatoire à la création d'une règle.
- **Groupes d'onglets natifs Chrome** (option activable) : tous les onglets d'un même client sont regroupés et colorés.
- **Dark mode automatique** du popup (suit le thème de ton système).
- **Synchronisation** des règles via ton compte Google (`chrome.storage.sync`) : mêmes règles sur tes différents postes.
- **Application en direct** : ajoute/modifie une règle, les onglets ouverts se mettent à jour sans rechargement.

---

## 🚀 Installation

L'extension n'est pas (encore) sur le Chrome Web Store — installation en **mode développeur** :

1. Récupère le code :
   ```bash
   git clone https://github.com/WilfriedW/ColorTab.git
   ```
   (ou télécharge le ZIP puis décompresse-le)
2. Ouvre `chrome://extensions` dans Chrome.
3. Active **« Mode développeur »** (en haut à droite).
4. Clique **« Charger l'extension non empaquetée »** et sélectionne le dossier `ColorTab`.
5. L'icône ColorTab apparaît dans la barre d'outils. 🎉

> Compatible avec tous les navigateurs basés sur Chromium (Chrome, Edge, Brave…).

---

## 🧭 Utilisation

1. Clique sur l'icône **ColorTab** pour ouvrir le popup.
2. **« + Ajouter une règle »** : une couleur aléatoire est assignée (modifiable via le carré de couleur).
3. Saisis le **pattern** du domaine (voir ci-dessous) et un **label** (le nom affiché dans le badge et le groupe).
4. Optionnel : coche **« Grouper les onglets par règle »** pour regrouper et colorer les onglets nativement.

Les onglets déjà ouverts se colorent en direct. Astuce : la première fois après
une mise à jour de l'extension, recharge une fois l'onglet concerné.

---

## 🔤 Syntaxe des patterns

| Pattern | Ce que ça matche |
|---|---|
| `google.com` | le domaine **et tous ses sous-domaines** : `google.com`, `www.google.com`, `mail.google.com`… |
| `*.service-now.com` | **uniquement les sous-domaines** : `dev123.service-now.com` (pas le domaine nu) |
| `agircarrco*.service-now.com` | sous-domaines **commençant par** `agircarrco` |

Le `*` remplace une portion de nom **sans point**. Un pattern sans `*` couvre le
domaine et toute sa hiérarchie de sous-domaines. Les correspondances sont sûres :
`google.com` ne matche **ni** `notgoogle.com` **ni** `google.com.evil.com`.

Quand plusieurs règles correspondent, la plus **spécifique** (la plus longue, le
moins de jokers) l'emporte.

---

## 💡 Exemple : jongler avec des instances clients

Typiquement, avec plusieurs instances ServiceNow :

| Pattern | Couleur | Label |
|---|---|---|
| `clientA-prod.service-now.com` | 🔴 rouge | `CLIENT A — PROD` |
| `clientA-qualif.service-now.com` | 🟢 vert | `CLIENT A — QUALIF` |
| `clientB*.service-now.com` | 🔵 bleu | `CLIENT B` |

Résultat : un coup d'œil à la barre d'onglets suffit pour savoir où tu es. Le
**rouge = prod**, on réfléchit à deux fois avant de cliquer. 😉

---

## ⚙️ Comment ça marche

- Un **service worker** (`background/`) lit l'URL de chaque onglet, trouve la règle correspondante, puis pilote la couleur et le regroupement.
- Un **content script** (`content/`) injecté dans la page dessine la pastille (favicon), le liseré et le badge.
- Le **popup** (`popup/`) gère les règles et l'option de regroupement, stockées dans `chrome.storage.sync`.

---

## ⚠️ Limites connues

- **Groupes d'onglets** : Chrome n'offre que **8 couleurs natives** de groupe ; la couleur du groupe est donc la plus proche de ta couleur (la pastille, elle, garde la teinte exacte). Grouper **déplace** aussi les onglets pour les coller (comportement natif de Chrome).
- **Pages restreintes** : la pastille/le liseré n'apparaissent pas sur `chrome://`, le Chrome Web Store, les PDF ou les pages vides (le content script n'y est pas injecté).
- **Ownership des groupes** : un groupe est considéré « à nous » s'il porte le même nom qu'une règle ; évite de nommer un groupe manuel exactement comme un label de règle.

---

## 🗂️ Structure du projet

```
ColorTab/
├── manifest.json          # Déclaration de l'extension (MV3)
├── background/
│   ├── background.js       # Service worker : règles, couleurs, groupes
│   └── colors.js           # Mapping couleur → couleur native Chrome (+ test)
├── content/
│   ├── content.js          # Pastille (favicon), liseré, badge
│   └── content.css
├── popup/
│   ├── popup.html / .js / .css   # Réglage des règles + dark mode
└── icons/
```

Tests de la logique de couleur :
```bash
node background/colors.test.mjs
```

---

## 🤝 Partage

Projet perso, partagé entre collègues — n'hésite pas à proposer des
améliorations ou à signaler un souci. Bon code couleur ! 🌈
