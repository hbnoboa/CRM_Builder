import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Manages local file storage for the offline upload queue.
/// Files are staged in `appDocDir/upload_queue/` before upload.
class LocalFileStorage {
  LocalFileStorage._();

  static final instance = LocalFileStorage._();

  static const _queueDir = 'upload_queue';
  late Directory _directory;

  /// Initialize the upload queue directory.
  Future<void> initialize() async {
    final appDir = await getApplicationDocumentsDirectory();
    _directory = Directory('${appDir.path}/$_queueDir');
    if (!await _directory.exists()) {
      await _directory.create(recursive: true);
    }
  }

  /// Stage a file for upload by copying it to the queue directory.
  /// Returns the new local path.
  Future<String> stageFile(String sourcePath) async {
    final sourceFile = File(sourcePath);
    final ext = sourcePath.contains('.') ? '.${sourcePath.split('.').last}' : '';
    final fileName = '${const Uuid().v4()}$ext';
    final destPath = '${_directory.path}/$fileName';
    await sourceFile.copy(destPath);
    return destPath;
  }

  /// Delete a staged file after successful upload.
  Future<void> deleteFile(String path) async {
    final file = File(path);
    if (await file.exists()) {
      await file.delete();
    }
  }

  /// Get total size of the upload queue directory in bytes.
  Future<int> getQueueSize() async {
    if (!await _directory.exists()) return 0;
    int total = 0;
    await for (final entity in _directory.list()) {
      if (entity is File) {
        total += await entity.length();
      }
    }
    return total;
  }

  /// Remove orphaned files (files in queue dir without a matching DB entry).
  /// [activeLocalPaths] - set of local_path values from the queue table.
  Future<int> cleanup(Set<String> activeLocalPaths) async {
    if (!await _directory.exists()) return 0;
    int removed = 0;
    await for (final entity in _directory.list()) {
      if (entity is File && !activeLocalPaths.contains(entity.path)) {
        await entity.delete();
        removed++;
      }
    }
    return removed;
  }

  /// Get the queue directory path.
  String get directoryPath => _directory.path;
}
