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
- **Beschriftbare Kanten** – frei oder per Schnellauswahl: Chen (`1`, `N`, `M`) oder Min-Max (`(0,1)`, `(1,1)`, `(0,*)`, `(1,*)`). Eingaben wie `0..1`, `1..*`, `1,n` oder `(0,N)` werden einheitlich als `(min,max)` mit `*` für „beliebig viele“ geschrieben. Kardinalitäten stehen an der Entity und lassen sich entlang der Kante verschieben.
- Varianten: schwache Entity, identifizierende Beziehung, partieller Schlüssel, mehrwertiges und abgeleitetes Attribut, totale Teilnahme (Doppellinie)
- **Rekursive Beziehungen** mit **Rollennamen** – zwei Kanten zur selben Entity werden als Bögen gezeichnet
- **Generalisierung/Spezialisierung (is-a):** Dreieck mit Spitze zur Oberklasse, total/partiell und disjunkt/überlappend; `+ Spezialisierung` an einer Entity legt Dreieck und erste Unterklasse an
- **Pfeile an Kanten** (zum Ziel, zum Start, beidseitig) und **Richtung umkehren**
- **Relationenmodell & SQL:** Tabellen mit Primär- und Fremdschlüsseln sowie ein `CREATE TABLE`-Skript automatisch ableiten (1:1, 1:N, N:M, mehrstellige, rekursive Beziehungen, schwache Entities, Spezialisierungen, mehrwertige und zusammengesetzte Attribute; Chen- und Min-Max-Notation)
- **Schnelleingabe:** Element auswählen, `Tab`, Attribute tippen, `Enter` legt das nächste an; `*` am Anfang = Schlüssel
- **Als Bild kopieren** (`⇧⌘C`) – Diagramm oder Auswahl zum direkten Einfügen in andere Programme
- **Suchen** (`⌘F`), **Übersichtskarte** und **Auf Auswahl zoomen** (`⇧F`)
- **Notizen**, **Farben** und **Sperren** von Elementen
- **Drucken / Als PDF sichern** (`⌘P`)
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
| Attribute schnell eingeben | Element auswählen, `Tab`, tippen, `Enter` für das nächste, leeres `Enter` oder `Esc` beendet |
| Als Bild kopieren | `⇧⌘`/`⇧Strg` + `C` (bei Auswahl nur die Auswahl) |
| Suchen | `⌘`/`Strg` + `F`, `Enter` springt zum nächsten Treffer |
| Spezialisierung | Werkzeug **is-a** (`G`) oder `+ Spezialisierung` an einer Entity; Oberklasse im Panel |
| Pfeil an einer Kante | Kante auswählen, im Panel **Pfeil** wählen oder Rechtsklick |
| Notiz | Werkzeug **Notiz** (`N`), `⇧Enter` für eine neue Zeile |
| Drucken / PDF | `⌘`/`Strg` + `P` |
| Verschieben | Element ziehen (bei Mehrfachauswahl alle gemeinsam), Pfeiltasten zur Feinjustierung |
| Ansicht verschieben | Scrollen oder Leertaste + Ziehen |
| Zoomen | `⌘`/`Strg` + Scrollen, `+` / `-`, `F` passt alles ein, `⇧F` zoomt auf die Auswahl |
| Löschen | `Entf` / `Backspace` |
| Rückgängig | `⌘`/`Strg` + `Z`, Wiederholen mit `⇧` |

Im Browser speichert der Editor automatisch; mit **Speichern** / **Öffnen** werden Diagramme als JSON-Datei gesichert und geladen.

## Mac-App

Die Mac-App arbeitet mit echten Dokumenten:

- Jedes Diagramm ist eine **`.erd`-Datei** in einem eigenen Fenster; Doppelklick im Finder öffnet sie.
- Menü **Ablage**: Neu, Öffnen, Zuletzt benutzt, Sichern, Duplizieren, Umbenennen, Bewegen, Zurücksetzen, Alle Versionen durchsuchen, Relationenmodell & SQL, Export als SVG/PNG, Drucken
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
- `relational.js` – Ableitung von Relationenmodell und SQL (auch in Node nutzbar)
- `changelog.js` – Versionsverlauf (Quelle für das Neuigkeiten-Fenster und `CHANGELOG.md`)
- `tools/changelog.py` – erzeugt `CHANGELOG.md`
- `macos/` – Mac-App (Swift), Icon und Build-Skript
