# Versionsverlauf

Wird aus `changelog.js` erzeugt (`tools/changelog.py`).

## 1.4.0 – 26. Oktober 2026

- Generalisierung/Spezialisierung: neues Element „is-a“ (Dreieck, Werkzeug G); die Spitze zeigt automatisch zur Oberklasse, Vollständigkeit (total/partiell) und Überschneidung (disjunkt/überlappend) einstellbar
- „+ Spezialisierung“ an jeder Entity legt Dreieck und erste Unterklasse in einem Schritt an; „+ Unterklasse“ am Dreieck ergänzt weitere
- Relationenmodell & SQL: Unterklassen übernehmen den Schlüssel der Oberklasse als Primär- und Fremdschlüssel, auch über mehrere Stufen
- Pfeile an Kanten: zum Ziel, zum Start oder an beiden Enden, dazu „Richtung umkehren“ – im Panel und per Rechtsklick
- Mac-App: Sichern bleibt nicht mehr hängen – der Inhalt wird beim Sichern nicht mehr erst aus der Oberfläche abgefragt

## 1.3.1 – 22. Oktober 2026

- Min-Max-Notation schreibt „beliebig viele“ jetzt als * statt n: (0,*), (1,*); Eingaben wie 1,n oder (0,N) werden automatisch umgeschrieben
- Ältere Diagramme mit (0,n) oder (1,n) werden beim Öffnen auf * umgestellt

## 1.3.0 – 19. Oktober 2026

- Rekursive Beziehungen (z. B. „Mitarbeiter leitet Mitarbeiter“): zwei Kanten zur selben Entity als Bögen, mit Rollennamen
- Schnelleingabe: Element auswählen, Tab drücken, Attribute tippen und mit Enter das nächste anlegen; „*“ am Anfang macht einen Schlüssel
- Relationenmodell und SQL: Tabellen und CREATE-TABLE-Skript automatisch aus dem Diagramm ableiten (Knopf „Tabellen“)
- Als Bild kopieren (⇧⌘C): Diagramm oder Auswahl direkt in Word, Pages oder Keynote einfügen
- Suchen (⌘F) mit Springen zwischen Treffern, Übersichtskarte in der Ecke, Auf Auswahl zoomen (⇧F)
- Notizen als frei platzierbare Zettel, Farben für Elemente und Sperren gegen versehentliches Verschieben oder Löschen
- Drucken und Als PDF sichern (⌘P); Mac-App: „Alle Versionen durchsuchen …“ im Menü Ablage
- Leeres Diagramm zeigt eine kurze Anleitung; Hinzufügen-Knöpfe weichen nach unten aus, wenn oben etwas im Weg ist
- Werkzeugleiste blendet in schmalen Fenstern die Beschriftungen aus

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
