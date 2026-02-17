import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import 'package:crm_mobile/core/cache/crm_cache_manager.dart';
import 'package:crm_mobile/core/database/app_database.dart';
import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/core/upload/local_file_storage.dart';
import 'package:crm_mobile/core/upload/upload_queue_service.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';

/// Image/file picker + upload widget for entity data forms.
/// Picks from camera or gallery, compresses, uploads to API.
/// When offline, enqueues upload and returns a local:// URL placeholder.
class ImageFieldInput extends ConsumerStatefulWidget {
  const ImageFieldInput({
    super.key,
    required this.label,
    this.value,
    required this.fieldType,
    required this.isRequired,
    required this.onChanged,
    this.entitySlug = '',
    this.recordId = '',
    this.fieldSlug = '',
  });

  final String label;
  final String? value;
  final String fieldType; // 'IMAGE' or 'FILE'
  final bool isRequired;
  final ValueChanged<dynamic> onChanged;

  /// Context for offline queue (needed to PATCH record after upload).
  final String entitySlug;
  final String recordId;
  final String fieldSlug;

  @override
  ConsumerState<ImageFieldInput> createState() => _ImageFieldInputState();
}

class _ImageFieldInputState extends ConsumerState<ImageFieldInput> {
  final _picker = ImagePicker();
  bool _isUploading = false;
  double _uploadProgress = 0;
  String? _currentUrl;
  File? _localPreview;
  String? _error;
  bool _isPendingUpload = false;

  @override
  void initState() {
    super.initState();
    _currentUrl = widget.value;
    _isPendingUpload = widget.value?.startsWith('local://') ?? false;
    // If we have a local:// URL, try to resolve the local file for preview
    if (_isPendingUpload && widget.value != null) {
      _resolveLocalPreview(widget.value!);
    }
  }

  Future<void> _resolveLocalPreview(String localUrl) async {
    final queueId = localUrl.replaceFirst('local://', '');
    try {
      final db = AppDatabase.instance.db;
      final results = await db.getAll(
        'SELECT local_path FROM file_upload_queue WHERE id = ?',
        [queueId],
      );
      if (results.isNotEmpty) {
        final localPath = results.first['local_path'] as String?;
        if (localPath != null) {
          final file = File(localPath);
          if (await file.exists() && mounted) {
            setState(() => _localPreview = file);
          }
        }
      }
    } catch (_) {}
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 90,
      );
      if (picked == null) return;

      setState(() {
        _localPreview = File(picked.path);
        _isUploading = true;
        _uploadProgress = 0;
        _error = null;
        _isPendingUpload = false;
      });

      // Compress image
      final tempDir = await getTemporaryDirectory();
      final targetPath =
          '${tempDir.path}/${const Uuid().v4()}.jpg';

      final compressed = await FlutterImageCompress.compressAndGetFile(
        picked.path,
        targetPath,
        quality: 80,
        minWidth: 1200,
        minHeight: 1200,
      );

      final fileToUpload = compressed != null ? File(compressed.path) : File(picked.path);
      final fileName = '${const Uuid().v4()}.jpg';

      // Check connectivity
      final connectivityResult = await Connectivity().checkConnectivity();
      final isOnline = !connectivityResult.contains(ConnectivityResult.none) &&
          connectivityResult.isNotEmpty;

      if (isOnline) {
        // Online: upload directly (fast path)
        final repo = ref.read(dataRepositoryProvider);
        final url = await repo.uploadFile(
          filePath: fileToUpload.path,
          fileName: fileName,
          folder: 'data',
          onProgress: (sent, total) {
            if (total > 0 && mounted) {
              setState(() => _uploadProgress = sent / total);
            }
          },
        );

        setState(() {
          _currentUrl = url;
          _isUploading = false;
          _isPendingUpload = false;
        });
        widget.onChanged(url);
      } else {
        // Offline: stage file and enqueue for later upload
        final stagedPath = await LocalFileStorage.instance.stageFile(fileToUpload.path);
        final fileSize = await File(stagedPath).length();
        final queueService = ref.read(uploadQueueServiceProvider);
        final queueId = await queueService.enqueue(
          localPath: stagedPath,
          fileName: fileName,
          folder: 'data',
          entitySlug: widget.entitySlug,
          recordId: widget.recordId,
          fieldSlug: widget.fieldSlug,
          mimeType: 'image/jpeg',
          fileSize: fileSize,
        );

        final localUrl = 'local://$queueId';
        setState(() {
          _currentUrl = localUrl;
          _isUploading = false;
          _isPendingUpload = true;
        });
        widget.onChanged(localUrl);
      }
    } catch (e) {
      setState(() {
        _isUploading = false;
        _error = 'Erro ao enviar: $e';
      });
    }
  }

  void _showPickerSheet() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () {
                Navigator.of(ctx).pop();
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Galeria'),
              onTap: () {
                Navigator.of(ctx).pop();
                _pickImage(ImageSource.gallery);
              },
            ),
            if (_currentUrl != null)
              ListTile(
                leading: const Icon(Icons.delete_outlined, color: AppColors.destructive),
                title: const Text('Remover', style: TextStyle(color: AppColors.destructive)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  setState(() {
                    _currentUrl = null;
                    _localPreview = null;
                  });
                  widget.onChanged(null);
                },
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      initialValue: _currentUrl,
      validator: widget.isRequired
          ? (v) => (_currentUrl == null || _currentUrl!.isEmpty)
              ? '${widget.label} obrigatorio'
              : null
          : null,
      builder: (fieldState) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.label, style: AppTypography.labelLarge),
            const SizedBox(height: 8),

            // Preview area
            if (_isUploading) ...[
              _buildUploadingIndicator(),
            ] else if (_localPreview != null || _currentUrl != null) ...[
              _buildPreview(),
            ] else ...[
              _buildEmptyPicker(),
            ],

            // Error messages
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  _error!,
                  style: AppTypography.caption.copyWith(color: AppColors.error),
                ),
              ),
            if (fieldState.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  fieldState.errorText!,
                  style: AppTypography.caption.copyWith(color: AppColors.error),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildEmptyPicker() {
    return GestureDetector(
      onTap: _showPickerSheet,
      child: Container(
        height: 150,
        width: double.infinity,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border, width: 1.5),
          borderRadius: BorderRadius.circular(AppColors.radius),
          color: AppColors.muted,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              widget.fieldType == 'IMAGE'
                  ? Icons.add_a_photo_outlined
                  : Icons.attach_file,
              size: 36,
              color: AppColors.mutedForeground,
            ),
            const SizedBox(height: 8),
            Text(
              widget.fieldType == 'IMAGE'
                  ? 'Toque para adicionar imagem'
                  : 'Toque para anexar arquivo',
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreview() {
    return GestureDetector(
      onTap: _showPickerSheet,
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppColors.radius),
            child: _localPreview != null
                ? Image.file(
                    _localPreview!,
                    height: 200,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  )
                : (_currentUrl != null && _currentUrl!.startsWith('http'))
                    ? CachedNetworkImage(
                        imageUrl: _currentUrl!,
                        cacheManager: CrmCacheManager(),
                        height: 200,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          height: 200,
                          color: AppColors.muted,
                          child: const Center(child: CircularProgressIndicator()),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          height: 200,
                          color: AppColors.muted,
                          child: const Icon(Icons.broken_image_outlined, size: 48),
                        ),
                      )
                    : Container(
                        height: 200,
                        color: AppColors.muted,
                        child: const Center(
                          child: Icon(Icons.image_outlined, size: 48),
                        ),
                      ),
          ),
          // Pending upload indicator
          if (_isPendingUpload)
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.warning,
                  borderRadius: BorderRadius.circular(AppColors.radiusSm),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.cloud_upload_outlined, size: 14, color: Colors.white),
                    SizedBox(width: 4),
                    Text(
                      'Pendente',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          // Change button overlay
          Positioned(
            bottom: 8,
            right: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(AppColors.radiusSm),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.edit, size: 14, color: Colors.white),
                  const SizedBox(width: 4),
                  Text(
                    'Alterar',
                    style: AppTypography.caption.copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadingIndicator() {
    return Container(
      height: 150,
      width: double.infinity,
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppColors.radius),
        color: AppColors.muted,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (_localPreview != null)
            Expanded(
              child: Opacity(
                opacity: 0.5,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppColors.radius),
                  child: Image.file(
                    _localPreview!,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                SizedBox(
                  width: 120,
                  child: LinearProgressIndicator(
                    value: _uploadProgress > 0 ? _uploadProgress : null,
                    minHeight: 4,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _uploadProgress > 0
                      ? 'Enviando ${(_uploadProgress * 100).toInt()}%'
                      : 'Preparando...',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
