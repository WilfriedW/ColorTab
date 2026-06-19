# 🎨 ColorTab

> Know which client instance you're on, at a glance.

ColorTab assigns a **color to your Chrome tabs based on their domain**. Define a
rule per domain, and every matching tab gets a clear visual marker — so you never
mix up two look‑alike instances again.

Each rule gives you **four visual cues**:

- 🟩 **a colored dot** on the tab icon (exact color, visible even when the tab is inactive);
- 📏 **a colored border** around the page;
- 🏷️ **a badge** in the top‑right corner showing the rule's name (stays visible);
- 🗂️ **native tab grouping** by client (optional).

Built for people who juggle many instances across many clients (ServiceNow & the
like), where a single misclick on the wrong *production* tab is one too many.

---

## ✨ Features

- **Domain rules** with wildcards (`*`) and "domain + subdomains" matching.
- **Exact colors** for the dot / border / badge; a random color is assigned when you create a rule.
- **Native Chrome tab groups** (optional toggle): all of a client's tabs get grouped and colored.
- **Automatic dark mode** for the popup (follows your system theme).
- **Synced rules** through your Google account (`chrome.storage.sync`): same rules across your machines.
- **Live updates**: add or edit a rule and open tabs update without a reload.

---

## 🚀 Installation

ColorTab isn't on the Chrome Web Store (yet) — install it in **developer mode**:

1. Get the code:
   ```bash
   git clone https://github.com/WilfriedW/ColorTab.git
   ```
   (or download the ZIP and extract it)
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top‑right).
4. Click **Load unpacked** and select the `ColorTab` folder.
5. The ColorTab icon shows up in your toolbar. 🎉

> Works on any Chromium‑based browser (Chrome, Edge, Brave…).

---

## 🧭 Usage

1. Click the **ColorTab** icon to open the popup.
2. **"+ Add a rule"**: a random color is assigned (change it via the color swatch).
3. Enter the domain **pattern** (see below) and a **label** (the name shown in the badge and the group).
4. Optional: tick **"Group tabs by rule"** to natively group and color the tabs.

Open tabs update live. Tip: right after updating the extension, reload the
affected tab once so it picks up the new version.

---

## 🔤 Pattern syntax

| Pattern | What it matches |
|---|---|
| `google.com` | the domain **and all its subdomains**: `google.com`, `www.google.com`, `mail.google.com`… |
| `*.service-now.com` | **subdomains only**: `dev123.service-now.com` (not the bare domain) |
| `agircarrco*.service-now.com` | subdomains **starting with** `agircarrco` |

`*` stands for a name segment **without a dot**. A pattern without `*` covers the
domain and its whole subdomain hierarchy. Matching is safe: `google.com` matches
**neither** `notgoogle.com` **nor** `google.com.evil.com`.

When several rules match, the most **specific** one wins (longest, fewest wildcards).

---

## 💡 Example: juggling client instances

A typical setup with several ServiceNow instances:

| Pattern | Color | Label |
|---|---|---|
| `clientA-prod.service-now.com` | 🔴 red | `CLIENT A — PROD` |
| `clientA-qualif.service-now.com` | 🟢 green | `CLIENT A — QUALIF` |
| `clientB*.service-now.com` | 🔵 blue | `CLIENT B` |

One glance at the tab bar tells you where you are. **Red = production**, so you
think twice before clicking. 😉

---

## ⚙️ How it works

- A **service worker** (`background/`) reads each tab's URL, finds the matching rule, then drives the color and grouping.
- A **content script** (`content/`) injected into the page draws the dot (favicon), the border and the badge.
- The **popup** (`popup/`) manages the rules and the grouping option, stored in `chrome.storage.sync`.

---

## ⚠️ Known limitations

- **Tab groups**: Chrome offers only **8 native group colors**, so the group color is the closest match to yours (the dot keeps the exact hue). Grouping also **moves** tabs to sit them together (native Chrome behavior).
- **Restricted pages**: the dot/border don't appear on `chrome://`, the Chrome Web Store, PDFs or blank pages (the content script isn't injected there).
- **Group ownership**: a group is considered "ours" if its title matches a rule's label; avoid naming a manual group exactly like a rule label.

---

## 🗂️ Project structure

```
ColorTab/
├── manifest.json          # Extension manifest (MV3)
├── background/
│   ├── background.js       # Service worker: rules, colors, groups
│   └── colors.js           # Color → native Chrome color mapping (+ test)
├── content/
│   ├── content.js          # Dot (favicon), border, badge
│   └── content.css
├── popup/
│   ├── popup.html / .js / .css   # Rule editor + dark mode
└── icons/
```

Run the color‑logic test:
```bash
node background/colors.test.mjs
```

---

## 🤝 Sharing

A personal project, shared among colleagues — feel free to suggest improvements
or report issues. Happy color‑coding! 🌈
