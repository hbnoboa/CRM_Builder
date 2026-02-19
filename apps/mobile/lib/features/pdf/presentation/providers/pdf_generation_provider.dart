import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:crm_mobile/core/network/api_client.dart';

part 'pdf_generation_provider.g.dart';

/// Status da geracao de PDF
class PdfGenerationStatus {
  PdfGenerationStatus({
    required this.status,
    this.downloadUrl,
    this.error,
    this.generationId,
  });

  final String status; // pending, processing, completed, failed
  final String? downloadUrl;
  final String? error;
  final String? generationId;

  bool get isCompleted => status == 'completed';
  bool get isFailed => status == 'failed';
  bool get isProcessing => status == 'processing' || status == 'pending';
}

/// Template de PDF disponivel
class PdfTemplate {
  PdfTemplate({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.entitySlug,
  });

  factory PdfTemplate.fromJson(Map<String, dynamic> json) {
    return PdfTemplate(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      entitySlug: json['entitySlug'] as String?,
    );
  }

  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? entitySlug;
}

/// Provider para listar templates disponiveis para uma entidade
@riverpod
Future<List<PdfTemplate>> pdfTemplatesForEntity(
  Ref ref,
  String entitySlug,
) async {
  final api = ref.watch(apiClientProvider);

  try {
    final response = await api.get('/pdf/templates/entity/$entitySlug');

    if (response.statusCode == 200) {
      final data = response.data as List<dynamic>? ?? [];
      return data
          .map((json) => PdfTemplate.fromJson(json as Map<String, dynamic>))
          .toList();
    }

    return [];
  } catch (e) {
    return [];
  }
}

/// Notifier para geracao de PDF
@riverpod
class PdfGeneration extends _$PdfGeneration {
  @override
  AsyncValue<PdfGenerationStatus?> build() {
    return const AsyncValue.data(null);
  }

  /// Solicita geracao de PDF ao backend
  Future<PdfGenerationStatus?> requestGeneration({
    required String templateId,
    String? recordId,
    Map<String, dynamic>? inputData,
  }) async {
    state = const AsyncValue.loading();

    try {
      final api = ref.read(apiClientProvider);

      // Solicitar geracao sincrona (para obter resultado imediato)
      final response = await api.post('/pdf/generate-sync', data: {
        'templateId': templateId,
        if (recordId != null) 'recordId': recordId,
        if (inputData != null) 'inputData': inputData,
      },);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;

        final status = PdfGenerationStatus(
          status: data['status'] as String? ?? 'completed',
          downloadUrl: data['fileUrl'] as String?,
          generationId: data['id'] as String?,
        );

        state = AsyncValue.data(status);
        return status;
      }

      throw Exception('Erro ao gerar PDF');
    } catch (e) {
      final errorStatus = PdfGenerationStatus(
        status: 'failed',
        error: e.toString(),
      );
      state = AsyncValue.data(errorStatus);
      return errorStatus;
    }
  }

  /// Solicita geracao assincrona (notificacao quando pronto)
  Future<String?> requestAsyncGeneration({
    required String templateId,
    String? recordId,
    Map<String, dynamic>? inputData,
  }) async {
    state = const AsyncValue.loading();

    try {
      final api = ref.read(apiClientProvider);

      final response = await api.post('/pdf/generate', data: {
        'templateId': templateId,
        if (recordId != null) 'recordId': recordId,
        if (inputData != null) 'inputData': inputData,
      },);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        final generationId = data['generationId'] as String?;

        state = AsyncValue.data(PdfGenerationStatus(
          status: 'pending',
          generationId: generationId,
        ),);

        return generationId;
      }

      throw Exception('Erro ao solicitar geracao de PDF');
    } catch (e) {
      state = AsyncValue.data(PdfGenerationStatus(
        status: 'failed',
        error: e.toString(),
      ),);
      return null;
    }
  }

  /// Verifica status de uma geracao
  Future<PdfGenerationStatus?> checkStatus(String generationId) async {
    try {
      final api = ref.read(apiClientProvider);

      final response = await api.get('/pdf/generation/$generationId');

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;

        final status = PdfGenerationStatus(
          status: data['status'] as String? ?? 'pending',
          downloadUrl: data['fileUrl'] as String?,
          generationId: generationId,
          error: data['error'] as String?,
        );

        state = AsyncValue.data(status);
        return status;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /// Limpa o estado
  void reset() {
    state = const AsyncValue.data(null);
  }
}
