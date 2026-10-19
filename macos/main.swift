// ER-Editor als dokumentbasierte Mac-App: jedes Diagramm ist eine Datei (.erd) in einem eigenen Fenster.
// Die Oberfläche ist die Web-App aus dem Bundle; ERBridge (app.js) verbindet beide Seiten.
import Cocoa
import UniformTypeIdentifiers
import WebKit

/// Leitet Nachrichten der Web-App weiter, ohne das Dokument festzuhalten.
final class WeakMessageProxy: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

@objc(ERDocument)
final class ERDocument: NSDocument, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate {
    private var json: String?       // zuletzt bekannter Inhalt, kommt bei jeder Änderung aus der Web-App
    private var webView: WKWebView?
    private var webReady = false

    override class var autosavesInPlace: Bool { true }

    override func makeWindowControllers() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()  // Einstellungen und Zwischenablage teilen sich alle Fenster
        config.userContentController.add(WeakMessageProxy(self), name: "er")
        let web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = self
        web.navigationDelegate = self
        web.setValue(false, forKey: "drawsBackground")  // kein weißes Aufblitzen im dunklen Modus
        webView = web

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.minSize = NSSize(width: 720, height: 480)
        window.contentView = web
        window.center()
        let controller = NSWindowController(window: window)
        controller.shouldCascadeWindows = true
        addWindowController(controller)

        let dir = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)
        web.loadFileURL(dir.appendingPathComponent("index.html"), allowingReadAccessTo: dir)
    }

    override func close() {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "er")
        super.close()
    }

    // MARK: Lesen und Schreiben

    override func read(from data: Data, ofType typeName: String) throws {
        guard let text = String(data: data, encoding: .utf8) else { throw CocoaError(.fileReadCorruptFile) }
        json = text
        if webReady { pushContent() }  // z. B. „Zurücksetzen auf“
    }

    override func data(ofType typeName: String) throws -> Data {
        Data((json ?? #"{"format":"er-editor","version":1,"title":"Unbenanntes Diagramm","nodes":[],"edges":[]}"#).utf8)
    }

    // Vor dem Schreiben den aktuellen Stand direkt aus der Web-App holen
    override func save(to url: URL, ofType typeName: String, for saveOperation: NSDocument.SaveOperationType,
                       completionHandler: @escaping (Error?) -> Void) {
        guard let web = webView, webReady else {
            return super.save(to: url, ofType: typeName, for: saveOperation, completionHandler: completionHandler)
        }
        web.evaluateJavaScript("ERBridge.flush()") { result, _ in
            if let text = result as? String { self.json = text }
            super.save(to: url, ofType: typeName, for: saveOperation, completionHandler: completionHandler)
        }
    }

    private func pushContent() {
        var argument = "null"
        if let json, let encoded = try? JSONSerialization.data(withJSONObject: [json]),
           let list = String(data: encoded, encoding: .utf8) {
            argument = String(list.dropFirst().dropLast())  // ["…"] -> "…" als JS-String
        }
        webView?.evaluateJavaScript("ERBridge.load(\(argument))")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webReady = true
        pushContent()
        // Nach dem ersten Bild wieder deckend zeichnen – spart das Überblenden mit dem Fensterhintergrund
        webView.setValue(true, forKey: "drawsBackground")
    }

    // MARK: Nachrichten aus der Web-App

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "changed":
            json = body["json"] as? String
            updateChangeCount(.changeDone)
        case "theme":
            // Fensterrahmen passend zum gewählten Design (nil = wie das System)
            let names: [String: NSAppearance.Name] = ["light": .aqua, "dark": .darkAqua]
            let appearance = (body["value"] as? String).flatMap { names[$0] }.flatMap { NSAppearance(named: $0) }
            for controller in windowControllers { controller.window?.appearance = appearance }
        case "command":
            switch body["name"] as? String {
            case "new": NSDocumentController.shared.newDocument(nil)
            case "open": NSDocumentController.shared.openDocument(nil)
            case "save": save(nil)
            default: break
            }
        default:
            break
        }
    }

    /// Menübefehle, die die Web-App ausführt (representedObject = Befehlsname in ERBridge.menu)
    @objc func webCommand(_ sender: NSMenuItem) {
        guard let command = sender.representedObject as? String else { return }
        webView?.evaluateJavaScript("ERBridge.menu('\(command)')")
    }

    // MARK: Downloads (SVG, PNG)

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 preferences: WKWebpagePreferences,
                 decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow, preferences)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard let window = webView?.window else { return completionHandler(nil) }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.canCreateDirectories = true
        panel.beginSheetModal(for: window) { result in
            guard result == .OK, let url = panel.url else { return completionHandler(nil) }
            // Überschreiben wurde im Dialog bestätigt; WKDownload schreibt nicht über bestehende Dateien.
            try? FileManager.default.removeItem(at: url)
            completionHandler(url)
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        guard let window = webView?.window else { return }
        NSAlert(error: error).beginSheetModal(for: window)
    }

    // MARK: Datei-Auswahl, alert(), confirm()

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        guard let window = webView.window else { return completionHandler(nil) }
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.json]
        panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard let window = webView.window else { return completionHandler() }
        let alert = NSAlert()
        alert.messageText = message
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard let window = webView.window else { return completionHandler(false) }
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Abbrechen")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }
}

// MARK: - App und Menüs

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = buildMenu()
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool { true }

    private func buildMenu() -> NSMenu {
        let main = NSMenu()

        main.addItem(submenu("ER-Editor", [
            item("Über ER-Editor", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
            web("Neuigkeiten …", "changelog"),
            .separator(),
            item("ER-Editor ausblenden", #selector(NSApplication.hide(_:)), "h"),
            item("Andere ausblenden", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
            item("Alle einblenden", #selector(NSApplication.unhideAllApplications(_:))),
            .separator(),
            item("ER-Editor beenden", #selector(NSApplication.terminate(_:)), "q"),
        ]))

        let recent = NSMenu(title: "Zuletzt benutzt")
        recent.addItem(item("Einträge löschen", #selector(NSDocumentController.clearRecentDocuments(_:))))
        recent.perform(NSSelectorFromString("_setMenuName:"), with: "NSRecentDocumentsMenu")
        let recentItem = NSMenuItem(title: "Zuletzt benutzt", action: nil, keyEquivalent: "")
        recentItem.submenu = recent

        main.addItem(submenu("Ablage", [
            item("Neu", #selector(NSDocumentController.newDocument(_:)), "n"),
            item("Öffnen …", #selector(NSDocumentController.openDocument(_:)), "o"),
            recentItem,
            .separator(),
            item("Schließen", #selector(NSWindow.performClose(_:)), "w"),
            item("Sichern …", #selector(NSDocument.save(_:)), "s"),
            item("Duplizieren", #selector(NSDocument.duplicate(_:)), "s", [.command, .shift]),
            item("Umbenennen …", #selector(NSDocument.rename(_:))),
            item("Bewegen …", #selector(NSDocument.move(_:))),
            item("Zurücksetzen auf zuletzt gesichert", #selector(NSDocument.revertToSaved(_:))),
            .separator(),
            web("Als SVG exportieren …", "exportSVG", "e", [.command, .option]),
            web("Als PNG exportieren …", "exportPNG", "e", [.command, .shift]),
        ]))

        main.addItem(submenu("Bearbeiten", [
            web("Widerrufen", "undo", "z"),
            web("Wiederholen", "redo", "z", [.command, .shift]),
            .separator(),
            item("Ausschneiden", #selector(NSText.cut(_:)), "x"),
            item("Kopieren", #selector(NSText.copy(_:)), "c"),
            item("Einsetzen", #selector(NSText.paste(_:)), "v"),
            web("Auswahl duplizieren", "duplicate", "d"),
            web("Löschen", "delete"),
            web("Alles auswählen", "selectAll", "a"),
        ]))

        main.addItem(submenu("Darstellung", [
            web("Vergrößern", "zoomIn", "+"),
            web("Verkleinern", "zoomOut", "-"),
            web("Originalgröße", "zoomReset", "0"),
            web("Alles einpassen", "fit", "9"),
            .separator(),
            web("Nächster Hinweis", "nextIssue", "i", [.command, .option]),
            .separator(),
            web("Design: Automatisch", "themeAuto"),
            web("Design: Hell", "themeLight"),
            web("Design: Dunkel", "themeDark"),
            .separator(),
            item("Vollbild", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
        ]))

        let windowMenu = submenu("Fenster", [
            item("Im Dock ablegen", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("Zoomen", #selector(NSWindow.performZoom(_:))),
            .separator(),
            item("Alle nach vorne bringen", #selector(NSApplication.arrangeInFront(_:))),
        ])
        main.addItem(windowMenu)
        NSApp.windowsMenu = windowMenu.submenu

        return main
    }

    private func item(_ title: String, _ action: Selector, _ key: String = "",
                      _ modifiers: NSEvent.ModifierFlags = [.command]) -> NSMenuItem {
        let menuItem = NSMenuItem(title: title, action: action, keyEquivalent: key)
        menuItem.keyEquivalentModifierMask = modifiers
        return menuItem
    }

    /// Menüeintrag, der einen Befehl der Web-App im aktiven Dokument auslöst
    private func web(_ title: String, _ command: String, _ key: String = "",
                     _ modifiers: NSEvent.ModifierFlags = [.command]) -> NSMenuItem {
        let menuItem = item(title, #selector(ERDocument.webCommand(_:)), key, modifiers)
        menuItem.representedObject = command
        return menuItem
    }

    private func submenu(_ title: String, _ items: [NSMenuItem]) -> NSMenuItem {
        let menu = NSMenu(title: title)
        items.forEach(menu.addItem)
        let holder = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        holder.submenu = menu
        return holder
    }
}

let app = NSApplication.shared
_ = NSDocumentController.shared  // vor dem Start anlegen, damit Dokumenttypen und „Zuletzt benutzt“ greifen
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
