import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import 'package:crm_mobile/core/theme/app_colors.dart';
import 'package:crm_mobile/core/theme/app_typography.dart';
import 'package:crm_mobile/features/data/data/data_repository.dart';

/// Image/file picker + upload widget for entity data forms.
/// Picks from camera or gallery, compresses, uploads to API,
/// and calls onChanged with the returned URL.
class ImageFieldInput extends ConsumerStatefulWidget {
  const ImageFieldInput({
    super.key,
    required this.label,
    this.value,
    required this.fieldType,
    required this.isRequired,
    required this.onChanged,
  });

  final String label;
  final String? value;
  final String fieldType; // 'IMAGE' or 'FILE'
  final bool isRequired;
  final ValueChanged<dynamic> onChanged;

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

  @override
  void initState() {
    super.initState();
    _currentUrl = widget.value;
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

      // Upload to API with progress
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
      });
      widget.onChanged(url);
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
                leading: Icon(Icons.delete_outlined, color: AppColors.destructive),
                title: Text('Remover', style: TextStyle(color: AppColors.destructive)),
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
                : CachedNetworkImage(
                    imageUrl: _currentUrl!,
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
