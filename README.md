# Adelschronik

Ein vollständig lokaler, statischer Editor für Stammbäume und historische Zeitleisten. Die Gestaltung orientiert sich an klassischen genealogischen Schautafeln: warmes Elfenbein, goldene Karten und Verbindungen sowie markante schwarze Typografie.

Die Website benötigt weder Installation noch Build-Schritt, Datenbank, Konto oder externe Dienste. Alle Dateien liegen direkt in diesem Ordner.

## Enthaltene Funktionen

- Stammbaum mit Personen, Lebensdaten, optionalen Bildern und mehreren Titeln samt Amtszeiten
- automatisch erzeugte, farbcodierte Titellegende ohne doppelte Einträge
- familienweise Anordnung mit zusammenhängenden Geschwistergruppen und klaren Eltern-Kind-Verbindungen
- frei wählbare Farbe für Karten und Verbindungslinien, separat je Projekt
- Eltern-Kind-Verbindungen und Partnerschaften mit automatischer Anordnung und Schutz vor Kreisen
- Zeitleiste mit Ereignissen, Zeiträumen, Kategorien, Notizen und Bildern
- Karten frei verschieben; Arbeitsfläche zoomen, verschieben und einpassen
- mehrere Projekte im Browser verwalten, umbenennen, duplizieren und löschen
- eigenes Wappen pro Projekt, das in der fertigen Grafik erscheint
- automatische lokale Speicherung im Browser
- Projekte als JSON sichern und wieder importieren
- aktuelle Darstellung als hochauflösendes PNG oder skalierbares SVG exportieren
- Beispielprojekt „Haus von Falkenstein“
- responsive Bedienung für Desktop, Tablet und Smartphone
- keine externen Bibliotheken, Schriften, Tracker oder CDNs

## Direkt ausprobieren

`index.html` kann direkt im Browser geöffnet werden. Für die zuverlässigste Vorschau empfiehlt sich ein kleiner lokaler Webserver, ist aber für GitHub Pages nicht nötig. Nach dem Laden arbeitet der Editor ohne externe Dienste; für ein erneutes Öffnen der GitHub-Pages-Adresse wird weiterhin eine Internetverbindung benötigt.

## Auf GitHub Pages veröffentlichen

### Variante A: neues Repository über die GitHub-Website

1. Auf GitHub oben rechts **New repository** wählen.
2. Einen Namen vergeben, zum Beispiel `adelschronik`, und das Repository als **Public** anlegen.
3. In diesem Ordner **alle Dateien** auswählen und in die oberste Ebene des Repositorys hochladen. `index.html` muss also direkt im Hauptverzeichnis liegen, nicht in einem zusätzlichen Unterordner.
4. Im Repository **Settings → Pages** öffnen.
5. Unter **Build and deployment** bei **Source** die Option **Deploy from a branch** wählen.
6. Als Branch **main** und als Ordner **/ (root)** auswählen, dann **Save** klicken.
7. Nach ein bis zwei Minuten erscheint oben auf derselben Seite die öffentliche Adresse, typischerweise `https://BENUTZERNAME.github.io/adelschronik/`.

### Variante B: vorhandenes Repository

Den kompletten Inhalt dieses Ordners in das gewünschte Verzeichnis des Repositorys kopieren. Wenn die Dateien nicht im Repository-Hauptverzeichnis liegen, muss GitHub Pages passend über eine Action oder einen eigenen Veröffentlichungs-Branch konfiguriert werden.

Alle internen Pfade sind relativ. Daher funktioniert die Website sowohl unter einer eigenen Domain als auch unter einem GitHub-Unterpfad wie `/adelschronik/`.

## Datensicherung

Die automatische Speicherung nutzt `localStorage`. Die Projekte bleiben damit nur in genau diesem Browserprofil auf diesem Gerät. Sie werden nicht zu GitHub hochgeladen und nicht zwischen Geräten synchronisiert.

Für eine dauerhafte Sicherung regelmäßig oben auf **Daten → Projekt als JSON exportieren** klicken. Die entstandene JSON-Datei kann später über **Daten → JSON importieren** wieder geöffnet werden.

Wichtig: Private-Browsing-Modi oder das Löschen von Browserdaten können lokal gespeicherte Projekte entfernen. Bilder werden direkt in der JSON-Datei und im Browserspeicher abgelegt; sehr viele oder sehr große Bilder können dessen Speichergrenze erreichen. Beim Einfügen werden große Bilder deshalb automatisch verkleinert.

## Dateien

- `index.html` – Oberfläche, Dialoge und barrierearme Struktur
- `styles.css` – responsive Gestaltung des Editors
- `app.js` – Datenmodell, lokale Speicherung, Visualisierung und Exporte
- `.nojekyll` – verhindert unnötige Jekyll-Verarbeitung auf GitHub Pages

## Browser

Empfohlen sind aktuelle Versionen von Chrome, Edge, Firefox oder Safari. Für PNG- und SVG-Export muss der Browser das Canvas- und Blob-API unterstützen, was bei aktuellen Browsern standardmäßig der Fall ist.

## Datenschutz

Die Anwendung führt keine Netzwerkanfragen aus. Sämtliche Inhalte und hochgeladenen Bilder bleiben lokal im Browser, bis sie bewusst als Datei exportiert werden.
