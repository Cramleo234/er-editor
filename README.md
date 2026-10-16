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

Was sich in welcher Version geändert hat: [Versionsverlauf](CHANGELOG.md). Nach einem Update zeigt die App die Neuerungen einmal an; jederzeit über **Neuigkeiten** im Hilfe-Panel bzw. **ER-Editor → Neuigkeiten …** in der Mac-App.

## Funktionen

- **Entity** (Rechteck), **Beziehung** (Raute), **Attribut** (Ellipse) und **Schlüsselattribut** (unterstrichen)
- **Beschriftbare Kanten** – frei oder per Schnellauswahl: Chen (`1`, `N`, `M`) oder Min-Max (`(0,1)`, `(1,1)`, `(0,n)`, `(1,n)`). Eingaben wie `0..1`, `1..*` oder `1,n` werden einheitlich als `(min,max)` geschrieben. Kardinalitäten stehen an der Entity und lassen sich entlang der Kante verschieben.
- Varianten: schwache Entity, identifizierende Beziehung, partieller Schlüssel, mehrwertiges und abgeleitetes Attribut, totale Teilnahme (Doppellinie)
- **Anfasser zum Verbinden:** Über einem Element erscheinen vier Anfasser. Ziehen auf ein anderes Element verbindet, Ziehen ins Leere legt direkt das passende Gegenstück an (Entity → Beziehung, Beziehung → Entity, Attribut → Teilattribut).
- **Schnell-Hinzufügen** am Element: `+ Attribut`, `+ Schlüssel`, `+ Beziehung` bzw. `+ Entity` – neu, verbunden und an freier Stelle platziert
- **Attribute anordnen:** verteilt alle Attribute eines Elements im Bogen auf der Seite ohne Beziehungen
- **Rechtsklick-Menü** für Fläche, Element, Kante und Mehrfachauswahl (inkl. Ausrichten und Verteilen)
- **Kopieren, Ausschneiden, Einsetzen, Duplizieren** – auch zwischen mehreren Fenstern
- **Einrasten am Raster** und **Hilfslinien** beim Ausrichten an anderen Elementen (`⌥`/`Alt` hält das Einrasten an)
- **Hinweise im Diagramm**, z. B. Entity ohne Schlüssel oder Beziehung mit nur einer Entity – der Warnknopf springt zum nächsten
- **Helles und dunkles Design** (automatisch nach System oder fest eingestellt)
- Werkzeuge bleiben nach dem Platzieren aktiv, Rahmen-Auswahl, Rückgängig/Wiederholen, Zoomen
- Export als **SVG** und **PNG** (immer hell)

## Bedienung

| Aktion | So geht's |
| --- | --- |
| Entity anlegen | Doppelklick auf eine leere Stelle |
| Element platzieren | Werkzeug wählen (`E`, `R`, `A`, `K`), auf die Fläche klicken – das Werkzeug bleibt aktiv, `Esc` oder `V` führt zurück; mit `⇧` ohne Benennen |
| Verbinden | Anfasser eines Elements ziehen – oder Werkzeug **Kante** (`C`) |
| Umbenennen / Kante beschriften | Doppelklick oder `Enter` |
| Kardinalität verschieben | Beschriftung entlang der Kante ziehen |
| Menü | Rechtsklick (Mac: auch `Ctrl` + Klick) |
| Mehrere auswählen | Rahmen auf dem Hintergrund ziehen, `⇧` + Klick ergänzt, `⌘`/`Strg` + `A` wählt alles |
| Kopieren / Einsetzen / Duplizieren | `⌘`/`Strg` + `C` / `V` / `D` |
| Verschieben | Element ziehen (bei Mehrfachauswahl alle gemeinsam), Pfeiltasten zur Feinjustierung |
| Ansicht verschieben | Scrollen oder Leertaste + Ziehen |
| Zoomen | `⌘`/`Strg` + Scrollen, `+` / `-`, `F` passt alles ein |
| Löschen | `Entf` / `Backspace` |
| Rückgängig | `⌘`/`Strg` + `Z`, Wiederholen mit `⇧` |

Im Browser speichert der Editor automatisch; mit **Speichern** / **Öffnen** werden Diagramme als JSON-Datei gesichert und geladen.

## Mac-App

Die Mac-App arbeitet mit echten Dokumenten:

- Jedes Diagramm ist eine **`.erd`-Datei** in einem eigenen Fenster; Doppelklick im Finder öffnet sie.
- Menü **Ablage**: Neu, Öffnen, Zuletzt benutzt, Sichern, Duplizieren, Umbenennen, Bewegen, Zurücksetzen, Export als SVG/PNG
- Änderungen werden wie bei Pages automatisch gesichert; ungesicherte Dokumente sind im Fenstertitel markiert.
- `.json`-Dateien aus der Browser-Version lassen sich ebenfalls öffnen (auch über „Öffnen mit“).
- Ein in früheren Versionen automatisch gespeichertes Diagramm wird beim ersten Start einmalig als neues Dokument übernommen.

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

Erzeugt `build/ER-Editor.app` und `build/ER-Editor-<Version>.dmg` (Version aus `VERSION`). Vorher den neuen Eintrag in `changelog.js` ergänzen – das Skript bricht ab, wenn die neueste Version dort nicht zu `VERSION` passt, und erzeugt daraus `CHANGELOG.md`. Die App ist eine dokumentbasierte Hülle (NSDocument + WKWebView) um dieselben Web-Dateien und läuft offline.

## Dateien

- `index.html` – Oberfläche
- `style.css` – Gestaltung
- `app.js` – Editor-Logik (Vanilla JavaScript, SVG)
- `changelog.js` – Versionsverlauf (Quelle für das Neuigkeiten-Fenster und `CHANGELOG.md`)
- `tools/changelog.py` – erzeugt `CHANGELOG.md`
- `macos/` – Mac-App (Swift), Icon und Build-Skript
