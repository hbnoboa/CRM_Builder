import { AxiosError } from 'axios';
import api from '@/lib/api';

/**
 * Baixa um arquivo da API (com o token) e salva no navegador. Se a API responder
 * erro, o corpo vem como Blob: converte para JSON para getErrorMessage funcionar.
 */
export async function downloadFromApi(url: string, fallbackName: string, timeout = 600_000): Promise<void> {
  try {
    const res = await api.get<Blob>(url, { responseType: 'blob', timeout });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* corpo nao e JSON: fica a mensagem padrao */
      }
    }
    throw error;
  }
}
