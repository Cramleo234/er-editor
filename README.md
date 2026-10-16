# ER-Editor

Ein kleiner Editor für Entity-Relationship-Diagramme in Chen-Notation – läuft komplett im Browser, ohne Installation und ohne Abhängigkeiten.

**Live:** https://cramleo234.github.io/er-editor/

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

## Dateien

- `index.html` – Oberfläche
- `style.css` – Gestaltung
- `app.js` – Editor-Logik (Vanilla JavaScript, SVG)
