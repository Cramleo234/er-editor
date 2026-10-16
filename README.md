# ER-Editor

Ein kleiner Editor für Entity-Relationship-Diagramme in Chen-Notation – läuft komplett im Browser, ohne Installation und ohne Abhängigkeiten.

**Live im Browser:** https://cramleo234.github.io/er-editor/

## Als Mac-App per Homebrew

```bash
brew tap cramleo234/public
brew trust cramleo234/public
brew install --cask cramleo234/public/er-editor
```

Die App ist nicht von Apple notarisiert. Beim ersten Start unter **Systemeinstellungen → Datenschutz & Sicherheit** auf **Trotzdem öffnen** klicken.

## Funktionen

- **Entity** (Rechteck), **Beziehung** (Raute), **Attribut** (Ellipse) und **Schlüsselattribut** (unterstrichen)
- **Beschriftbare Kanten** – frei oder per Schnellauswahl (`1`, `N`, `M`, `0..1`, `1..*`, `(0,n)` …)
- Varianten: schwache Entity, identifizierende Beziehung, partieller Schlüssel, mehrwertiges und abgeleitetes Attribut, totale Teilnahme (Doppellinie)
- Attribute werden automatisch mit dem ausgewählten Element verbunden
- Rückgängig/Wiederholen, Zoomen, Verschieben, Alles einpassen
- Automatisches Speichern im Browser, Speichern/Öffnen als JSON
- Export als **SVG** und **PNG**

## Bedienung

| Aktion | So geht's |
| --- | --- |
| Element platzieren | Werkzeug wählen (`E`, `R`, `A`, `K`), auf die Fläche klicken – mit `⇧` bleibt das Werkzeug aktiv |
| Umbenennen / Kante beschriften | Doppelklick oder `Enter` |
| Verbinden | Werkzeug **Kante** (`C`): Quelle und Ziel anklicken oder von Element zu Element ziehen |
| Verschieben | Element ziehen, Feinjustierung mit Pfeiltasten |
| Ansicht verschieben | Hintergrund ziehen, Scrollen oder Leertaste + Ziehen |
| Zoomen | `⌘`/`Strg` + Scrollen, `+` / `-`, `F` passt alles ein |
| Löschen | `Entf` / `Backspace` |
| Rückgängig | `⌘`/`Strg` + `Z`, Wiederholen mit `⇧` |

## Lokal starten

Einfach `index.html` im Browser öffnen – oder einen kleinen Server starten:

```bash
python3 -m http.server 8000
```

und http://localhost:8000 aufrufen.

## Mac-App selbst bauen

```bash
macos/build.sh
```

Erzeugt `build/ER-Editor.app` und `build/ER-Editor-<Version>.dmg` (Version aus `VERSION`). Die App ist eine schlanke WKWebView-Hülle um dieselben Web-Dateien und läuft offline.

## Dateien

- `index.html` – Oberfläche
- `style.css` – Gestaltung
- `app.js` – Editor-Logik (Vanilla JavaScript, SVG)
- `macos/` – Mac-App (Swift), Icon und Build-Skript
