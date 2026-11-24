import { AxiosError } from 'axios';

// Sem resposta do servidor o axios devolve "Network Error"/"timeout of ...ms exceeded" em
// ingles. Aqui nao ha hook de traducao: o idioma vem do <html lang> que o layout define.
const NETWORK_MESSAGES: Record<string, string> = {
  'pt-BR': 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
  en: 'No connection to the server. Check your internet and try again.',
  es: 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
};

function networkMessage(): string {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : '';
  return NETWORK_MESSAGES[lang] || NETWORK_MESSAGES['pt-BR'];
}

/**
 * Extracts a human-readable error message from an unknown error.
 * Handles AxiosError (API responses), standard Error, and unknown types.
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof AxiosError) {
    if (!error.response && error.code !== 'ERR_CANCELED') return networkMessage();
    return error.response?.data?.message || error.message || fallback || 'Error';
  }
  if (error instanceof Error) {
    return error.message || fallback || 'Error';
  }
  return fallback || 'Error';
}
