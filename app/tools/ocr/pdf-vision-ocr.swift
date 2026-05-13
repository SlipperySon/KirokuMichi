import AppKit
import Foundation
import PDFKit
import Vision

struct OcrPage: Encodable {
  let page: Int
  let text: String
  let charCount: Int
}

struct OcrResult: Encodable {
  let file: String
  let pages: Int
  let extractedPages: Int
  let extractedChars: Int
  let results: [OcrPage]
}

enum OcrError: Error, CustomStringConvertible {
  case invalidArguments
  case invalidPageRange
  case pdfOpenFailed(String)
  case pageRenderFailed(Int)

  var description: String {
    switch self {
    case .invalidArguments:
      return "Usage: pdf-vision-ocr <pdf-path> <start-page> <page-limit>"
    case .invalidPageRange:
      return "start-page and page-limit must be positive integers"
    case .pdfOpenFailed(let path):
      return "Could not open PDF: \(path)"
    case .pageRenderFailed(let page):
      return "Could not render PDF page \(page)"
    }
  }
}

func debug(_ message: String) {
  if ProcessInfo.processInfo.environment["OCR_DEBUG"] == "1" {
    FileHandle.standardError.write(Data(("[ocr] \(message)\n").utf8))
  }
}

func renderPage(_ page: PDFPage) -> CGImage? {
  let pageBounds = page.bounds(for: .mediaBox)
  let maxDimension: CGFloat = 2200
  let scale = min(maxDimension / max(pageBounds.width, pageBounds.height), 3.0)
  let size = NSSize(width: max(1, pageBounds.width * scale), height: max(1, pageBounds.height * scale))
  let image = page.thumbnail(of: size, for: .mediaBox)
  var proposedRect = NSRect(origin: .zero, size: image.size)
  return image.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil)
}

func recognizeText(in image: CGImage) throws -> String {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  let preferredLanguages = ["ja-JP", "en-US"]
  let supportedLanguages = (try? request.supportedRecognitionLanguages()) ?? []
  let availableLanguages = preferredLanguages.filter { supportedLanguages.contains($0) }
  if !availableLanguages.isEmpty {
    request.recognitionLanguages = availableLanguages
  }

  let handler = VNImageRequestHandler(cgImage: image, options: [:])
  try handler.perform([request])

  return (request.results ?? [])
    .compactMap { $0.topCandidates(1).first?.string }
    .joined(separator: "\n")
}

func main() throws {
  let args = CommandLine.arguments
  guard args.count == 4 else { throw OcrError.invalidArguments }

  let pdfPath = args[1]
  guard let startPage = Int(args[2]), let pageLimit = Int(args[3]), startPage > 0, pageLimit > 0 else {
    throw OcrError.invalidPageRange
  }

  guard let document = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    throw OcrError.pdfOpenFailed(pdfPath)
  }

  let totalPages = document.pageCount
  let startIndex = min(startPage - 1, max(0, totalPages - 1))
  let endIndex = min(totalPages, startIndex + pageLimit)
  var pages: [OcrPage] = []

  for pageIndex in startIndex..<endIndex {
    debug("render page \(pageIndex + 1)")
    guard let page = document.page(at: pageIndex), let image = renderPage(page) else {
      throw OcrError.pageRenderFailed(pageIndex + 1)
    }

    debug("recognize page \(pageIndex + 1) image=\(image.width)x\(image.height)")
    let text = try recognizeText(in: image)
    debug("recognized page \(pageIndex + 1) chars=\(text.count)")
    pages.append(OcrPage(page: pageIndex + 1, text: text, charCount: text.count))
  }

  let result = OcrResult(
    file: URL(fileURLWithPath: pdfPath).lastPathComponent,
    pages: totalPages,
    extractedPages: pages.count,
    extractedChars: pages.reduce(0) { $0 + $1.charCount },
    results: pages
  )

  let encoder = JSONEncoder()
  encoder.outputFormatting = [.withoutEscapingSlashes]
  FileHandle.standardOutput.write(try encoder.encode(result))
}

do {
  try main()
} catch {
  let message: String
  if error is OcrError {
    message = String(describing: error)
  } else {
    let nsError = error as NSError
    message = "\(nsError.domain) code=\(nsError.code): \(nsError.localizedDescription)"
  }
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(1)
}
