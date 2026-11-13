'use client';

import { useEffect } from 'react';

/**
 * Enderecos antigos das paginas de registro (/novo e /<id>) -> /new e /<id>/edit,
 * mantendo os parametros (?pai=, ?voltar=). Links ja copiados continuam funcionando.
 */
export function LegacyRecordRedirect({ to }: { to: (pathname: string) => string }) {
  useEffect(() => {
    const { pathname, search } = window.location;
    window.location.replace(`${to(pathname)}${search}`);
  }, [to]);
  return null;
}
