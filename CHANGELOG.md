# Versionsverlauf

Wird aus `changelog.js` erzeugt (`tools/changelog.py`).

## 1.2.1 – 19. Oktober 2026

- Weniger Stromverbrauch: Beim Ziehen werden nur noch die bewegten Elemente und ihre Kanten neu gezeichnet, höchstens einmal pro Bild – bei großen Diagrammen rund 35-mal weniger Rechenarbeit
- Zoomen, Verschieben der Ansicht und Rahmen-Auswahl bündeln ihre Aktualisierungen ebenfalls pro Bild
- Schnellere Nachschlagetabellen für Elemente, Kanten und Textbreiten; Hinweise werden nur bei geändertem Aufbau neu geprüft
- Mac-App zeichnet nach dem Start deckend statt durchsichtig über dem Fensterhintergrund

## 1.2.0 – 16. Oktober 2026

- Versionsverlauf: Nach einem Update zeigt ein Fenster einmal, was neu ist; jederzeit über „Neuigkeiten“ im Hilfe-Panel bzw. im Menü ER-Editor erreichbar
- Versionsnummer im Hilfe-Panel

## 1.1.1 – 16. Oktober 2026

- Design-Knopf schaltet immer sichtbar zwischen Hell und Dunkel um; „Automatisch“ über Rechtsklick auf die Fläche bzw. das Menü Darstellung
- Fensterrahmen der Mac-App folgt dem gewählten Design
- Anfasser und Schnell-Hinzufügen erscheinen auch bei aktivem Entity-, Beziehungs- oder Attribut-Werkzeug

## 1.1.0 – 16. Oktober 2026

- Anfasser zum Verbinden: auf ein anderes Element ziehen verbindet, ins Leere ziehen legt das passende Gegenstück an
- Schnell-Hinzufügen am Element: + Attribut, + Schlüssel, + Beziehung bzw. + Entity
- Attribute anordnen: verteilt alle Attribute im Bogen auf der Seite ohne Beziehungen
- Kardinalitäten stehen an der Entity und lassen sich entlang der Kante verschieben
- Rechtsklick-Menü mit Ausrichten und Verteilen
- Kopieren, Ausschneiden, Einsetzen und Duplizieren – auch zwischen Fenstern
- Einrasten am Raster und Hilfslinien; Doppelklick ins Leere legt eine Entity an
- Hinweise im Diagramm, z. B. „Kein Schlüsselattribut“ oder „Nur mit einer Entity verbunden“
- Helles und dunkles Design
- Mac-App mit echten Dokumenten: .erd-Dateien in eigenen Fenstern, Menü Ablage mit „Zuletzt benutzt“, automatisches Sichern

## 1.0.2 – 16. Oktober 2026

- Min-Max-Notation einheitlich als (min,max); Eingaben wie 0..1, 1..* oder 1,N werden automatisch umgeschrieben
- Schnellauswahl für Kanten: 1, N, M, (0,1), (1,1), (0,n), (1,n)

## 1.0.1 – 16. Oktober 2026

- Werkzeuge bleiben nach dem Platzieren aktiv – mehrere Entities, Attribute oder Kanten am Stück
- Rahmen-Auswahl und Mehrfachauswahl zum gemeinsamen Verschieben und Löschen
- Fehlerbehebungen beim Benennen und beim Ziehen doppelter Kanten

## 1.0.0 – 16. Oktober 2026

- Erste Version als Mac-App über Homebrew
- Entity, Beziehung, Attribut und Schlüsselattribut in Chen-Notation
- Beschriftbare Kanten, totale Teilnahme, schwache Entities und weitere Varianten
- Export als SVG und PNG, Speichern und Öffnen als JSON
