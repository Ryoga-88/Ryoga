// Read-only PhotoKit export of explicitly requested, currently included photos.
// Run from the project root with .local/photos/high-resolution-request.json.
// PhotoKit .current returns the rendered photo, preserving edits:
// https://developer.apple.com/documentation/photos/phimagemanager/requestimagedataandorientation(for:options:resulthandler:)
import Foundation
import Photos
import ImageIO
import UniformTypeIdentifiers
import AppKit

private struct ExportRequest: Decodable {
    let version: Int
    let ids: [String]
    let outputDirectory: String
}

private struct CuratedManifest: Decodable {
    struct Photo: Decodable { let id: String }
    let decisions: [String: String]
    let photos: [Photo]
}

private struct Catalog: Decodable {
    struct Photo: Decodable { let id: String; let countryCode: String? }
    let photos: [Photo]
}

private struct ExportResult: Codable {
    let id: String
    let status: String
    let fileName: String?
    let width: Int?
    let height: Int?
    let modifiedAt: String?
    let error: String?
}

private struct ExportReport: Codable {
    let version: Int
    let photos: [ExportResult]
}

private enum ExportError: Error {
    case invalid(String)
}

// Callbacks may arrive on a PhotoKit queue; the main thread keeps its run loop
// available while waiting for permission and asynchronous image requests.
private final class Completion<Value> {
    private let lock = NSLock()
    private var result: Value?

    func finish(_ value: Value) {
        lock.lock()
        defer { lock.unlock() }
        if result == nil { result = value }
    }

    func current() -> Value? {
        lock.lock()
        defer { lock.unlock() }
        return result
    }
}

private func wait<Value>(_ completion: Completion<Value>, seconds: TimeInterval) -> Value? {
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline {
        if let value = completion.current() { return value }
        RunLoop.current.run(until: Date().addingTimeInterval(0.1))
    }
    return completion.current()
}

private func log(_ message: String) {
    print(message)
    fflush(stdout)
}

private func normalizedID(_ value: String) -> String? {
    guard let uuid = UUID(uuidString: value), value.count == 36 else { return nil }
    return uuid.uuidString.lowercased()
}

private func decode<Value: Decodable>(_ type: Value.Type, from url: URL) throws -> Value {
    do {
        return try JSONDecoder().decode(type, from: Data(contentsOf: url))
    } catch {
        throw ExportError.invalid("invalid_input_json")
    }
}

private func includedIDs(at manifestURL: URL) throws -> Set<String> {
    let manifest = try decode(CuratedManifest.self, from: manifestURL)
    let publishedIDs = Set(manifest.photos.compactMap { normalizedID($0.id) })
    return Set(manifest.decisions.compactMap { id, decision in
        guard decision == "included", let normalized = normalizedID(id),
              publishedIDs.contains(normalized) else { return nil }
        return normalized
    })
}

private func modificationDate(of asset: PHAsset) -> String? {
    guard let date = asset.modificationDate else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
}

private struct ImageDescription {
    let width: Int
    let height: Int
    let fileExtension: String
}

private func describeImage(_ data: Data) -> ImageDescription? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          CGImageSourceGetCount(source) > 0,
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let rawWidth = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue,
          let rawHeight = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue,
          rawWidth > 0, rawHeight > 0,
          let type = CGImageSourceGetType(source),
          let fileExtension = UTType(type as String)?.preferredFilenameExtension,
          fileExtension.range(of: "^[a-zA-Z0-9]{1,16}$", options: .regularExpression) != nil
    else { return nil }
    let orientation = (properties[kCGImagePropertyOrientation] as? NSNumber)?.intValue ?? 1
    let swap = (5...8).contains(orientation)
    return ImageDescription(width: swap ? rawHeight : rawWidth,
                            height: swap ? rawWidth : rawHeight,
                            fileExtension: fileExtension.lowercased())
}

private func reusable(_ result: ExportResult, for asset: PHAsset, directory: URL) -> Bool {
    guard result.status == "exported", let fileName = result.fileName,
          fileName == URL(fileURLWithPath: fileName).lastPathComponent,
          fileName.hasPrefix(result.id + "."),
          let modifiedAt = result.modifiedAt,
          modifiedAt == modificationDate(of: asset) else { return false }
    let file = directory.appendingPathComponent(fileName)
    guard file.resolvingSymlinksInPath().deletingLastPathComponent() == directory,
          let data = try? Data(contentsOf: file), let info = describeImage(data),
          max(info.width, info.height) >= 1200,
          info.width == result.width, info.height == result.height else { return false }
    return true
}

private enum ImageResponse {
    case image(Data)
    case failure(String)
}

private func requestImage(_ asset: PHAsset, manager: PHImageManager) -> ImageResponse {
    let completion = Completion<ImageResponse>()
    let options = PHImageRequestOptions()
    options.version = .current
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .none
    options.isNetworkAccessAllowed = true
    options.isSynchronous = false
    let requestID = manager.requestImageDataAndOrientation(for: asset, options: options) {
        data, _, _, info in
        if (info?[PHImageCancelledKey] as? NSNumber)?.boolValue == true {
            completion.finish(.failure("request_cancelled"))
        } else if info?[PHImageErrorKey] != nil {
            completion.finish(.failure("request_failed"))
        } else if (info?[PHImageResultIsDegradedKey] as? NSNumber)?.boolValue == true {
            return
        } else if let data = data, !data.isEmpty {
            completion.finish(.image(data))
        } else {
            completion.finish(.failure("image_unavailable"))
        }
    }
    guard let result = wait(completion, seconds: 120) else {
        manager.cancelImageRequest(requestID)
        completion.finish(.failure("request_timeout"))
        return .failure("request_timeout")
    }
    return result
}

private func authorize() throws {
    var status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    if status == .notDetermined {
        log("photo_permission_required: awaiting native macOS permission dialog")
        let completion = Completion<PHAuthorizationStatus>()
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { completion.finish($0) }
        guard let updated = wait(completion, seconds: 120) else {
            throw ExportError.invalid("photo_permission_timeout")
        }
        status = updated
    }
    guard status == .authorized || status == .limited else {
        throw ExportError.invalid("photo_permission_denied")
    }
    log(status == .limited ? "photo_permission_limited" : "photo_permission_authorized")
}

private func findAssets(for ids: [String]) -> [String: PHAsset] {
    let wanted = Set(ids)
    var found: [String: PHAsset] = [:]
    // Apple local identifiers include a suffix. Try both known forms first;
    // then inspect identifiers only to resolve IDs from a read-only SQL import.
    let localIDs = ids.flatMap { [$0.uppercased(), $0.uppercased() + "/L0/001"] }
    PHAsset.fetchAssets(withLocalIdentifiers: localIDs, options: nil).enumerateObjects { asset, _, _ in
        let prefix = String(asset.localIdentifier.prefix(36)).lowercased()
        if wanted.contains(prefix), asset.mediaType == .image { found[prefix] = asset }
    }
    if found.count != wanted.count {
        PHAsset.fetchAssets(with: .image, options: nil).enumerateObjects { asset, _, stop in
            let prefix = String(asset.localIdentifier.prefix(36)).lowercased()
            if wanted.contains(prefix) { found[prefix] = asset }
            if found.count == wanted.count { stop.pointee = true }
        }
    }
    return found
}

private func run() throws -> Int32 {
    let files = FileManager.default
    let requestArgument: String
    let bundle = Bundle.main.bundleURL.standardizedFileURL.resolvingSymlinksInPath()
    if CommandLine.arguments.count == 1, bundle.lastPathComponent == "Ryoga Photo Export.app" {
        // LaunchServices starts apps without a project working directory. This
        // app is deliberately confined to the project's fixed .local location.
        let photosDirectory = bundle.deletingLastPathComponent()
        let projectRoot = photosDirectory.deletingLastPathComponent().deletingLastPathComponent()
        guard photosDirectory.path == projectRoot.path + "/.local/photos",
              files.changeCurrentDirectoryPath(projectRoot.path) else {
            throw ExportError.invalid("invalid_application_location")
        }
        let output = photosDirectory.appendingPathComponent("high-resolution", isDirectory: true)
        guard output.resolvingSymlinksInPath().path == output.path else {
            throw ExportError.invalid("output_directory_must_not_be_symlinked")
        }
        try files.createDirectory(at: output, withIntermediateDirectories: true)
        try files.setAttributes([.posixPermissions: 0o700], ofItemAtPath: output.path)
        let logURL = output.appendingPathComponent("export.log")
        guard logURL.resolvingSymlinksInPath().path == logURL.path,
              freopen(logURL.path, "a", stdout) != nil,
              freopen(logURL.path, "a", stderr) != nil else {
            throw ExportError.invalid("cannot_open_export_log")
        }
        try files.setAttributes([.posixPermissions: 0o600], ofItemAtPath: logURL.path)
        log("starting_selected_photo_export")
        requestArgument = ".local/photos/high-resolution-request.json"
        let application = NSApplication.shared
        application.setActivationPolicy(.regular)
        application.activate(ignoringOtherApps: true)
    } else if CommandLine.arguments.count == 2 {
        requestArgument = CommandLine.arguments[1]
    } else {
        throw ExportError.invalid("usage: export-selected-photos .local/photos/high-resolution-request.json")
    }
    let root = URL(fileURLWithPath: files.currentDirectoryPath, isDirectory: true).resolvingSymlinksInPath()
    let local = root.appendingPathComponent(".local/photos", isDirectory: true).resolvingSymlinksInPath()
    let expectedLocal = root.path + "/.local/photos"
    guard local.path == expectedLocal else { throw ExportError.invalid("local_directory_must_not_be_symlinked") }
    let requestURL = URL(fileURLWithPath: requestArgument, relativeTo: root)
        .standardizedFileURL.resolvingSymlinksInPath()
    guard requestURL.path.hasPrefix(local.path + "/") else {
        throw ExportError.invalid("request_must_be_inside_local_photos")
    }
    let request = try decode(ExportRequest.self, from: requestURL)
    let ids = request.ids.compactMap(normalizedID)
    guard request.version == 1, !ids.isEmpty, ids.count == request.ids.count,
          Set(ids).count == ids.count else { throw ExportError.invalid("invalid_request_ids") }
    let directory = URL(fileURLWithPath: request.outputDirectory, isDirectory: true)
        .standardizedFileURL.resolvingSymlinksInPath()
    guard request.outputDirectory.hasPrefix("/"), directory.path == local.path + "/high-resolution" else {
        throw ExportError.invalid("invalid_output_directory")
    }
    let manifestURL = root.appendingPathComponent("app/contents/curated-photos.json")
    let included = try includedIDs(at: manifestURL)
    let catalog = try decode(Catalog.self, from: local.appendingPathComponent("catalog.json"))
    let excluded = Set(["JP", "CN", "ES", "AL"])
    let allowed = Set(catalog.photos.compactMap { photo -> String? in
        guard let country = photo.countryCode, !country.isEmpty,
              !excluded.contains(country.uppercased()) else { return nil }
        return normalizedID(photo.id)
    })
    guard Set(ids).isSubset(of: included), Set(ids).isSubset(of: allowed) else {
        throw ExportError.invalid("request_contains_unselected_or_excluded_photo")
    }
    // Authorization is the only library-level operation. No performChanges or
    // PHAssetChangeRequest calls are made anywhere in this program.
    try authorize()
    let assets = findAssets(for: ids)
    log("selected=\(ids.count) matched=\(assets.count)")
    try files.createDirectory(at: directory, withIntermediateDirectories: true)
    let reportURL = directory.appendingPathComponent("export-results.json")
    guard reportURL.resolvingSymlinksInPath().deletingLastPathComponent() == directory else {
        throw ExportError.invalid("report_must_not_be_symlinked")
    }
    var results: [String: ExportResult] = [:]
    if files.fileExists(atPath: reportURL.path) {
        let previous = try decode(ExportReport.self, from: reportURL)
        guard previous.version == 1 else { throw ExportError.invalid("invalid_report_version") }
        for result in previous.photos {
            guard let id = normalizedID(result.id), included.contains(id) else { continue }
            // Reuse historical reports only when their basename already follows
            // the lowercase UUID contract. Uppercase exports are re-requested.
            results[id] = ExportResult(id: id, status: result.status,
                                       fileName: result.fileName, width: result.width,
                                       height: result.height, modifiedAt: result.modifiedAt,
                                       error: result.error)
        }
    }
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    let manager = PHImageManager.default()
    var succeeded = 0
    var failed = 0
    for (index, id) in ids.enumerated() {
        // Re-read decisions before each image request, including resumptions.
        guard try includedIDs(at: manifestURL).contains(id) else {
            throw ExportError.invalid("selection_changed_stopping_export")
        }
        let result: ExportResult = try autoreleasepool {
            guard let asset = assets[id] else {
                return ExportResult(id: id, status: "failed", fileName: nil, width: nil,
                                    height: nil, modifiedAt: nil, error: "asset_not_found")
            }
            if let previous = results[id], reusable(previous, for: asset, directory: directory) {
                if let fileName = previous.fileName {
                    try files.setAttributes([.posixPermissions: 0o600],
                                            ofItemAtPath: directory.appendingPathComponent(fileName).path)
                }
                return previous
            }
            let modifiedAt = modificationDate(of: asset)
            let fail: (String) -> ExportResult = { error in
                ExportResult(id: id, status: "failed", fileName: nil, width: nil,
                             height: nil, modifiedAt: modifiedAt, error: error)
            }
            switch requestImage(asset, manager: manager) {
            case .failure(let error):
                return fail(error)
            case .image(let data):
                guard let info = describeImage(data) else { return fail("invalid_image_data") }
                guard max(info.width, info.height) >= 1200 else { return fail("below_minimum_resolution") }
                // The user may deselect a photo while an iCloud request is in flight.
                guard try includedIDs(at: manifestURL).contains(id) else {
                    throw ExportError.invalid("selection_changed_stopping_export")
                }
                let fileName = id + "." + info.fileExtension
                let destination = directory.appendingPathComponent(fileName)
                guard destination.resolvingSymlinksInPath().deletingLastPathComponent() == directory else {
                    return fail("destination_must_not_be_symlinked")
                }
                do {
                    try data.write(to: destination, options: .atomic)
                    try files.setAttributes([.posixPermissions: 0o600], ofItemAtPath: destination.path)
                }
                catch { return fail("image_write_failed") }
                return ExportResult(id: id, status: "exported", fileName: fileName,
                                    width: info.width, height: info.height,
                                    modifiedAt: modifiedAt, error: nil)
            }
        }
        results[id] = result
        let report = ExportReport(version: 1, photos: results.values.sorted { $0.id < $1.id })
        do {
            try encoder.encode(report).write(to: reportURL, options: .atomic)
            try files.setAttributes([.posixPermissions: 0o600], ofItemAtPath: reportURL.path)
        }
        catch { throw ExportError.invalid("report_write_failed") }
        if result.status == "exported" { succeeded += 1 } else { failed += 1 }
        log("[\(index + 1)/\(ids.count)] \(id) \(result.status)\(result.error.map { " " + $0 } ?? "")")
    }
    log("completed exported=\(succeeded) failed=\(failed)")
    return failed == 0 ? 0 : 2
}

do {
    // Applies to atomic-write temporary files as well as final files.
    umask(0o077)
    exit(try run())
} catch ExportError.invalid(let message) {
    log("error: \(message)")
    exit(1)
} catch {
    // Foundation/PhotoKit errors can include private absolute paths or metadata.
    log("error: export_failed")
    exit(1)
}
