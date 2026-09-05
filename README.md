<div align="center">

# Focus

### Il tuo hub personale intelligente

[![Live App](https://img.shields.io/badge/Live-App-6366f1?style=for-the-badge&logo=safari&logoColor=white)](https://sabal-devops.github.io/focus/)
[![PWA](https://img.shields.io/badge/PWA-Ready-34d399?style=for-the-badge&logo=pwa&logoColor=white)](#installazione)
[![Version](https://img.shields.io/badge/v0.3.0-latest-8b5cf6?style=for-the-badge)](#changelog)

**Spesa, finanze, agenda e chat — tutto in un'app veloce, offline, sul tuo iPhone.**

[Apri Focus](https://sabal-devops.github.io/focus/) · [Funzionalità](#funzionalità) · [Installazione](#installazione)

---

</div>

## Funzionalità

### 🛒 Spesa & Dispensa
- **Lista della spesa** con categorie automatiche (Frutta, Latticini, Carne, Bevande...)
- **Multi-add**: scrivi `pane, latte e uova` e aggiunge 3 prodotti
- **Dispensa intelligente**: i prodotti completati vanno automaticamente in dispensa
- **Semaforo scorte**: terminati 🔴, quasi finiti 🟡, disponibili 🟢
- **Condividi** la lista via WhatsApp, Telegram o clipboard

### 💬 Chat Intelligente
- **Parser italiano** con 20+ pattern: `"ho speso 30 euro al supermercato"`, `"dentista giovedì alle 15"`
- Riconoscimento vocale e sintesi vocale (TTS)
- Supporto **Ollama AI** per risposte avanzate (opzionale)
- Tag azioni visibili nei messaggi bot

### 📅 Agenda
- **Eventi** con ricorrenze (settimanale, bisettimanale, mensile, annuale)
- **Scadenze** con urgenza a semaforo e categorie (documento, veicolo, salute...)
- Badge ricorrenza 🔁 sugli eventi virtuali

### 💰 Finanze
- **Grafico a barre** 6 mesi (entrate vs uscite)
- Breakdown per categoria con barre di progresso
- Soglie di spesa settimanale/mensile configurabili

### 🏠 Dashboard
- **Ricerca globale** trasversale (spesa, eventi, transazioni, scadenze)
- Avvisi intelligenti: scorte basse, scadenze vicine, spese in aumento
- Riepilogo mensile con statistiche
- Ultime attività

### 🔔 Notifiche Smart
- Prodotti terminati in dispensa
- Superamento soglia di spesa
- Eventi oggi/domani
- Scadenze in avvicinamento

---

## Tech Stack

| | Tecnologia |
|---|---|
| **Frontend** | Vanilla JS (ES Modules), zero dipendenze |
| **Storage** | IndexedDB (7 store, completamente offline) |
| **PWA** | Service Worker cache-first, manifest, installabile |
| **NLP** | Parser regex italiano (90+ food words, 40+ categorie) |
| **AI** | Ollama (opzionale, locale) |
| **Hosting** | GitHub Pages |
| **Design** | CSS custom properties, dark/light theme, iOS-native feel |

---

## Installazione

### iPhone (consigliato)
1. Apri **[Focus](https://sabal-devops.github.io/focus/)** in Safari
2. Tocca il pulsante **Condividi** (↑)
3. Seleziona **"Aggiungi a Home"**
4. L'app appare come icona nativa nella home

### Android
1. Apri il link in Chrome
2. Tocca **"Installa app"** nel banner o dal menu ⋮

### Desktop
Funziona in qualsiasi browser moderno. Su Chrome: menu → "Installa Focus".

---

## Architettura

```
focus/
├── index.html              # Entry point
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (cache-first)
├── css/
│   ├── variables.css       # Design tokens, dark/light theme
│   ├── base.css            # Reset, layout, animazioni
│   └── components.css      # UI components
├── js/
│   ├── app.js              # Bootstrap, routing
│   ├── router.js           # Hash-based SPA router
│   ├── db.js               # IndexedDB wrapper
│   ├── store.js            # Event bus (pub/sub)
│   ├── parser.js           # NLP italiano
│   ├── ai.js               # Ollama integration
│   ├── notifications.js    # Push notifications
│   ├── components/
│   │   ├── navbar.js       # Bottom tab bar
│   │   ├── modal.js        # Bottom sheet modal
│   │   └── toast.js        # Global toast feedback
│   └── views/
│       ├── home.js         # Dashboard + search
│       ├── chat.js         # Chat + voice
│       ├── spesa.js        # Spesa + Dispensa
│       ├── agenda.js       # Eventi + Scadenze
│       ├── finanze.js      # Grafici + transazioni
│       └── settings.js     # Config + backup
└── icons/
    ├── icon-192.svg
    └── icon-512.svg
```

---

## Sviluppo

```bash
# Serve locale
npx serve . -l 3000

# Apri nel browser
open http://localhost:3000
```

Nessun build step, nessun bundler, nessun framework. Modifica un file e ricarica.

---

## Changelog

### v0.3.0 (v13)
- Spesa + Dispensa unificata con tabs e categorie automatiche
- Navbar 5 tab diretti (Home, Chat, Spesa, Agenda, Finanze)
- Ricerca globale nella dashboard
- Condivisione lista spesa
- Notifiche smart (prodotti finiti, soglie spesa)
- Toast feedback globale
- Conferma eliminazione

### v0.2.0 (v12)
- Grafici finanze (barre 6 mesi)
- Ricorrenze eventi (settimanale, mensile, annuale)
- Import/export dati completo
- Fix bug critici (icone, chat destroy)

### v0.1.0 (v11)
- Prima release stabile
- Chat con parser italiano
- Spesa, dispensa, agenda, finanze
- PWA installabile

---

<div align="center">

**Made with ❤️ in Italy**

</div>
