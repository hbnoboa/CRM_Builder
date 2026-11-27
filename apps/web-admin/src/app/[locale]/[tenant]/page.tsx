import { redirect } from 'next/navigation';

/** Endereco da empresa sem pagina (/pt-BR/<empresa>): abre o Inicio em vez de uma tela em branco. */
export default function TenantRootRedirect({ params }: { params: { locale: string; tenant: string } }) {
  redirect(`/${params.locale}/${params.tenant}/home`);
}
