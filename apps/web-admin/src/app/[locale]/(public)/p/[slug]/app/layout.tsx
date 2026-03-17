'use client';

import { TenantProvider } from '@/stores/tenant-context';

export default function PublicAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantProvider>{children}</TenantProvider>;
}
