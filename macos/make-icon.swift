// Zeichnet das App-Icon (Entity – Beziehung) als PNG: swift make-icon.swift <ausgabe.png> <pixel>
import AppKit

let args = CommandLine.arguments
let out = URL(fileURLWithPath: args[1])
let px = CGFloat(Int(args[2]) ?? 1024)

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(px), pixelsHigh: Int(px),
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let s = px / 1024
func r(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect { NSRect(x: x * s, y: y * s, width: w * s, height: h * s) }
func c(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat(hex >> 16 & 255) / 255, green: CGFloat(hex >> 8 & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
}

// Hintergrund: abgerundetes Quadrat im macOS-Raster
let bg = NSBezierPath(roundedRect: r(100, 100, 824, 824), xRadius: 185 * s, yRadius: 185 * s)
NSGradient(starting: c(0xFFFFFF), ending: c(0xE9ECF3))!.draw(in: bg, angle: -90)
c(0xD3D8E2).setStroke(); bg.lineWidth = 4 * s; bg.stroke()

// Kanten
let line = NSBezierPath()
line.move(to: NSPoint(x: 330 * s, y: 600 * s)); line.line(to: NSPoint(x: 690 * s, y: 600 * s))
line.move(to: NSPoint(x: 330 * s, y: 600 * s)); line.line(to: NSPoint(x: 330 * s, y: 340 * s))
c(0x4A5263).setStroke(); line.lineWidth = 14 * s; line.stroke()

// Entity
let entity = NSBezierPath(roundedRect: r(190, 530, 280, 140), xRadius: 10 * s, yRadius: 10 * s)
c(0xE8EFFF).setFill(); entity.fill()
c(0x3355C4).setStroke(); entity.lineWidth = 18 * s; entity.stroke()

// Beziehung
let d = NSBezierPath()
d.move(to: NSPoint(x: 690 * s, y: 715 * s)); d.line(to: NSPoint(x: 820 * s, y: 600 * s))
d.line(to: NSPoint(x: 690 * s, y: 485 * s)); d.line(to: NSPoint(x: 560 * s, y: 600 * s)); d.close()
c(0xFFF2DC).setFill(); d.fill()
c(0xC97A1C).setStroke(); d.lineWidth = 18 * s; d.lineJoinStyle = .round; d.stroke()

// Schlüsselattribut
let attr = NSBezierPath(ovalIn: r(200, 260, 260, 150))
c(0xEFFAF2).setFill(); attr.fill()
c(0x2F8A4B).setStroke(); attr.lineWidth = 16 * s; attr.stroke()
let key = NSBezierPath()
key.move(to: NSPoint(x: 270 * s, y: 315 * s)); key.line(to: NSPoint(x: 390 * s, y: 315 * s))
c(0x1F2430).setStroke(); key.lineWidth = 14 * s; key.lineCapStyle = .round; key.stroke()

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: out)
