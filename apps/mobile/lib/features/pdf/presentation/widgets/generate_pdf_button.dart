import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';

import 'package:crm_mobile/features/pdf/presentation/providers/pdf_generation_provider.dart';

/// Botao para gerar PDF a partir de um registro
class GeneratePdfButton extends ConsumerWidget {
  const GeneratePdfButton({
    super.key,
    required this.entitySlug,
    required this.recordId,
    this.showLabel = false,
  });

  final String entitySlug;
  final String recordId;
  final bool showLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final templatesAsync = ref.watch(pdfTemplatesForEntityProvider(entitySlug));
    final generationState = ref.watch(pdfGenerationProvider);

    return templatesAsync.when(
      data: (templates) {
        if (templates.isEmpty) {
          return const SizedBox.shrink();
        }

        final isLoading = generationState.isLoading;

        if (showLabel) {
          return PopupMenuButton<PdfTemplate>(
            enabled: !isLoading,
            onSelected: (template) => _generatePdf(context, ref, template),
            itemBuilder: (context) => templates
                .map(
                  (t) => PopupMenuItem(
                    value: t,
                    child: Row(
                      children: [
                        const Icon(Icons.picture_as_pdf, size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(t.name),
                              if (t.description != null)
                                Text(
                                  t.description!,
                                  style: Theme.of(context).textTheme.bodySmall,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isLoading)
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    const Icon(Icons.picture_as_pdf),
                  const SizedBox(width: 8),
                  const Text('Gerar PDF'),
                  const Icon(Icons.arrow_drop_down),
                ],
              ),
            ),
          );
        }

        // Versao compacta (apenas icone)
        return PopupMenuButton<PdfTemplate>(
          enabled: !isLoading,
          icon: isLoading
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.picture_as_pdf),
          tooltip: 'Gerar PDF',
          onSelected: (template) => _generatePdf(context, ref, template),
          itemBuilder: (context) => templates
              .map(
                (t) => PopupMenuItem(
                  value: t,
                  child: Text(t.name),
                ),
              )
              .toList(),
        );
      },
      loading: () => const SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  Future<void> _generatePdf(
    BuildContext context,
    WidgetRef ref,
    PdfTemplate template,
  ) async {
    // Mostrar indicador de carregamento
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            ),
            SizedBox(width: 12),
            Text('Gerando PDF...'),
          ],
        ),
        duration: Duration(seconds: 30),
      ),
    );

    try {
      final status =
          await ref.read(pdfGenerationProvider.notifier).requestGeneration(
                templateId: template.id,
                recordId: recordId,
              );

      // Esconder snackbar de loading
      if (context.mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
      }

      if (status == null) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Erro ao gerar PDF'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      if (status.isFailed) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(status.error ?? 'Erro ao gerar PDF'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      if (status.isCompleted && status.downloadUrl != null) {
        if (context.mounted) {
          _showDownloadDialog(context, status.downloadUrl!, template.name);
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showDownloadDialog(
    BuildContext context,
    String downloadUrl,
    String templateName,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green),
            SizedBox(width: 8),
            Text('PDF Gerado'),
          ],
        ),
        content: Text('O documento "$templateName" foi gerado com sucesso.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Fechar'),
          ),
          TextButton.icon(
            onPressed: () {
              Navigator.of(context).pop();
              Share.share(downloadUrl, subject: '$templateName.pdf');
            },
            icon: const Icon(Icons.share),
            label: const Text('Compartilhar'),
          ),
          FilledButton.icon(
            onPressed: () {
              Navigator.of(context).pop();
              _openPdf(downloadUrl);
            },
            icon: const Icon(Icons.open_in_new),
            label: const Text('Abrir'),
          ),
        ],
      ),
    );
  }

  Future<void> _openPdf(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

/// Widget de acao para AppBar - versao simplificada
class GeneratePdfAction extends ConsumerWidget {
  const GeneratePdfAction({
    super.key,
    required this.entitySlug,
    required this.recordId,
  });

  final String entitySlug;
  final String recordId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GeneratePdfButton(
      entitySlug: entitySlug,
      recordId: recordId,
    );
  }
}
