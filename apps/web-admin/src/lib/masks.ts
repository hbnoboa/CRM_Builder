/**
 * Mascaras de formatacao para CPF, CNPJ e telefone.
 */

export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function unmask(value: string): string {
  return value.replace(/\D/g, '');
}

/** Formata CPF para exibicao a partir de digitos puros */
export function formatCpf(digits: string | null | undefined): string {
  if (!digits) return '';
  return maskCpf(digits);
}

/** Formata CNPJ para exibicao a partir de digitos puros */
export function formatCnpj(digits: string | null | undefined): string {
  if (!digits) return '';
  return maskCnpj(digits);
}

/** Formata telefone para exibicao a partir de digitos puros */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return '';
  return maskPhone(digits);
}
