import type { AiProposalDraft } from '@/hooks/use-ai-builder';

/** Exemplo do tutorial: mostra a edicao da previa sem gastar IA. */
export const SAMPLE_PROPOSAL: AiProposalDraft = {
  reply: 'Este é um exemplo para você ver como editar a proposta. Pode mexer à vontade: nada é criado.',
  tables: [
    {
      key: 'clientes', name: 'Cliente', namePlural: 'Clientes', description: 'Quem você atende.', icon: 'Users', color: 'blue',
      titleField: 'nome',
      fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: true, width: 'half' },
        { key: 'telefone', label: 'Telefone', type: 'phone', width: 'quarter' },
        { key: 'email', label: 'E-mail', type: 'email', width: 'quarter' },
        { key: 'cidade', label: 'Cidade', type: 'text', width: 'half' },
      ],
    },
    {
      key: 'visitas', name: 'Visita', namePlural: 'Visitas', description: 'Cada visita feita ao cliente.', icon: 'CalendarCheck', color: 'teal',
      parentKey: 'clientes', titleField: 'assunto', statusField: 'situacao', doneOptions: ['Concluída'], deadlineField: 'data',
      fields: [
        { key: 'assunto', label: 'Assunto', type: 'text', required: true },
        {
          key: 'situacao', label: 'Situação', type: 'select', width: 'quarter',
          options: [{ label: 'Agendada', color: 'blue' }, { label: 'Concluída', color: 'green' }, { label: 'Cancelada', color: 'gray' }],
        },
        { key: 'data', label: 'Data', type: 'date', width: 'quarter' },
        { key: 'fotos', label: 'Fotos', type: 'image', width: 'half' },
        { key: 'relato', label: 'Relato', type: 'textarea' },
      ],
    },
  ],
};
