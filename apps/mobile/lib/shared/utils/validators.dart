/// Common validation functions for forms.
class Validators {
  Validators._();

  static String? required(String? value, [String fieldName = 'Campo']) {
    if (value == null || value.trim().isEmpty) {
      return '$fieldName obrigatorio';
    }
    return null;
  }

  static String? email(String? value) {
    if (value == null || value.isEmpty) return 'Email obrigatorio';
    final emailRegex = RegExp(r'^[\w-.]+@([\w-]+\.)+[\w-]{2,}$');
    if (!emailRegex.hasMatch(value)) return 'Email invalido';
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) return 'Senha obrigatoria';
    if (value.length < 6) return 'Minimo 6 caracteres';
    return null;
  }

  static String? minLength(String? value, int min, [String fieldName = 'Campo']) {
    if (value == null || value.trim().length < min) {
      return '$fieldName deve ter no minimo $min caracteres';
    }
    return null;
  }
}
