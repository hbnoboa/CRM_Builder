'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

/**
 * Redireciona para /pages — a criação agora é feita pelo PageFormDialog.
 */
export default function NewPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/pages');
  }, [router]);

  return null;
}
