// Usage: swift tools/brand/og.swift <allura.woff2> <space-grotesk.woff2> <out.png> <tag|-> <line1> <line2>
// Renders a 1200x630 social card in the shared identity: ink background, the signature ("Is" in Allura gold +
// "mael Sarmiento"), an optional pill (e.g. "CV Online") and two lines of text. CoreGraphics + CoreText, no downloads.
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
let allura = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: a[1]) as CFURL) as! [CTFontDescriptor]
let grotesk = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: a[2]) as CFURL) as! [CTFontDescriptor]
let out = a[3], tag = a[4], line1 = a[5], line2 = a[6]
let W: CGFloat = 1200, H: CGFloat = 630
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
func rgb(_ h: UInt32, _ al: CGFloat = 1) -> CGColor {
  CGColor(srgbRed: CGFloat((h >> 16) & 255) / 255, green: CGFloat((h >> 8) & 255) / 255, blue: CGFloat(h & 255) / 255, alpha: al)
}
func font(_ d: [CTFontDescriptor], _ size: CGFloat, _ wght: CGFloat = 0) -> CTFont {
  let desc = wght > 0 ? CTFontDescriptorCreateCopyWithVariation(d[0], NSNumber(value: 0x77676874), wght) : d[0]
  return CTFontCreateWithFontDescriptor(desc, size, nil)
}
func line(_ s: String, _ f: CTFont, _ c: CGColor, kern: CGFloat = 0) -> CTLine {
  CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: [
    kCTFontAttributeName as NSAttributedString.Key: f, kCTForegroundColorAttributeName as NSAttributedString.Key: c,
    kCTKernAttributeName as NSAttributedString.Key: kern]))
}
func width(_ l: CTLine) -> CGFloat { CGFloat(CTLineGetTypographicBounds(l, nil, nil, nil)) }

// background: deep ink with a soft lift, and the circuit traces of IsAcademy on the right
ctx.setFillColor(rgb(0x0b1026)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
let glow = CGGradient(colorsSpace: cs, colors: [rgb(0x1b2247), rgb(0x0b1026)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: 420, y: 360), startRadius: 0, endCenter: CGPoint(x: 420, y: 360), endRadius: 720, options: [.drawsAfterEndLocation])
ctx.setStrokeColor(rgb(0xc8953f, 0.45)); ctx.setLineWidth(2); ctx.setFillColor(rgb(0xc8953f, 0.7))
for (y, x1, x2) in [(470.0, 980.0, 900.0), (420.0, 1040.0, 960.0), (190.0, 1000.0, 920.0), (140.0, 1060.0, 990.0)] {
  ctx.move(to: CGPoint(x: W, y: y)); ctx.addLine(to: CGPoint(x: x1, y: y)); ctx.addLine(to: CGPoint(x: x1 - 30, y: y - 30)); ctx.addLine(to: CGPoint(x: x2, y: y - 30))
  ctx.strokePath(); ctx.fillEllipse(in: CGRect(x: x2 - 5, y: y - 35, width: 10, height: 10))
}

let x0: CGFloat = 90
// signature: "Is" in gold script + "mael Sarmiento"
let isLine = line("Is", font(allura, 210), rgb(0xe2b25c))
ctx.textPosition = CGPoint(x: x0, y: 330); CTLineDraw(isLine, ctx)
let nameLine = line("mael Sarmiento", font(grotesk, 92, 500), rgb(0xf6f1e7), kern: -2)
ctx.textPosition = CGPoint(x: x0 + width(isLine) - 6, y: 334); CTLineDraw(nameLine, ctx)

var y: CGFloat = 250
if tag != "-" {
  let tl = line(tag, font(grotesk, 26, 600), rgb(0xe2b25c), kern: 1)
  let tw = width(tl) + 40
  let r = CGRect(x: x0 + 6, y: y - 12, width: tw, height: 44)
  ctx.addPath(CGPath(roundedRect: r, cornerWidth: 22, cornerHeight: 22, transform: nil))
  ctx.setStrokeColor(rgb(0xe2b25c)); ctx.setLineWidth(2); ctx.strokePath()
  ctx.textPosition = CGPoint(x: x0 + 26, y: y); CTLineDraw(tl, ctx)
  y -= 74
}
ctx.textPosition = CGPoint(x: x0 + 6, y: y); CTLineDraw(line(line1, font(grotesk, 36, 500), rgb(0xe7e9f5)), ctx)
ctx.setFillColor(rgb(0xc8953f)); ctx.fill(CGRect(x: x0 + 6, y: y - 34, width: 64, height: 4))
ctx.textPosition = CGPoint(x: x0 + 6, y: y - 84); CTLineDraw(line(line2, font(grotesk, 28, 400), rgb(0xb9bdd3), kern: 0.3), ctx)

let img = ctx.makeImage()!
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil); CGImageDestinationFinalize(dest)
print("ok \(out)")
