# 📋 Skill: Criar Entidade

## Quando Usar
Quando precisar criar uma nova entidade dinâmica no CRM Builder.

## Opção 1: Via API (Runtime)

```bash
# Criar entidade "Produto"
curl -X POST http://localhost:3001/api/v1/entities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace_id_aqui",
    "name": "Produto",
    "namePlural": "Produtos",
    "slug": "produto",
    "icon": "package",
    "color": "#10B981",
    "fields": [
      {
        "slug": "nome",
        "name": "Nome",
        "type": "text",
        "required": true
      },
      {
        "slug": "descricao",
        "name": "Descrição",
        "type": "textarea",
        "required": false
      },
      {
        "slug": "preco",
        "name": "Preço",
        "type": "currency",
        "required": true
      },
      {
        "slug": "categoria",
        "name": "Categoria",
        "type": "select",
        "required": true,
        "options": [
          { "label": "Eletrônicos", "value": "eletronicos" },
          { "label": "Roupas", "value": "roupas" },
          { "label": "Alimentos", "value": "alimentos" }
        ]
      },
      {
        "slug": "ativo",
        "name": "Ativo",
        "type": "boolean",
        "required": false,
        "defaultValue": true
      }
    ],
    "settings": {
      "titleField": "nome",
      "subtitleField": "categoria",
      "searchFields": ["nome", "descricao"]
    }
  }'
```

## Opção 2: Via Seed (Desenvolvimento)

```typescript
// apps/api/prisma/seed.ts

// Adicionar entidade no seed
const produtoEntity = await prisma.entity.upsert({
  where: {
    workspaceId_slug: {
      workspaceId: workspace.id,
      slug: 'produto',
    },
  },
  update: {},
  create: {
    tenantId: tenant.id,
    workspaceId: workspace.id,
    name: 'Produto',
    namePlural: 'Produtos',
    slug: 'produto',
    icon: 'package',
    color: '#10B981',
    fields: [
      {
        slug: 'nome',
        name: 'Nome',
        type: 'text',
        required: true,
      },
      {
        slug: 'preco',
        name: 'Preço',
        type: 'currency',
        required: true,
      },
      // ... mais campos
    ],
    settings: {
      titleField: 'nome',
      searchFields: ['nome'],
    },
  },
});

// Criar dados de exemplo
const produtos = [
  { nome: 'iPhone 15', preco: 7999.00, categoria: 'eletronicos' },
  { nome: 'Camiseta', preco: 79.90, categoria: 'roupas' },
];

for (const produto of produtos) {
  await prisma.entityData.create({
    data: {
      tenantId: tenant.id,
      entityId: produtoEntity.id,
      data: produto,
      createdById: adminUser.id,
    },
  });
}
```

## Tipos de Campo Disponíveis

| Tipo | Descrição | Opções |
|------|-----------|--------|
| `text` | Texto curto | `minLength`, `maxLength` |
| `textarea` | Texto longo | `minLength`, `maxLength` |
| `number` | Número inteiro | `min`, `max` |
| `decimal` | Número decimal | `min`, `max`, `precision` |
| `currency` | Moeda (BRL) | `min`, `max` |
| `email` | E-mail | - |
| `phone` | Telefone | - |
| `url` | URL | - |
| `date` | Data | `minDate`, `maxDate` |
| `datetime` | Data e hora | - |
| `boolean` | Sim/Não | - |
| `select` | Seleção única | `options` |
| `multiselect` | Seleção múltipla | `options` |
| `radio` | Radio buttons | `options` |
| `checkbox` | Checkboxes | `options` |
| `file` | Arquivo | `accept`, `maxSize` |
| `image` | Imagem | `accept`, `maxSize` |
| `color` | Cor | - |
| `relation` | FK para entidade | `entitySlug`, `displayField` |

## Configurações (settings)

```typescript
interface EntitySettings {
  // Campo usado como título na listagem
  titleField: string;
  
  // Campo usado como subtítulo
  subtitleField?: string;
  
  // Campos para busca
  searchFields: string[];
  
  // Ordenação padrão
  defaultSort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  
  // Campos visíveis na listagem
  listFields?: string[];
  
  // Campos visíveis no card
  cardFields?: string[];
}
```

## Permissões Automáticas

Ao criar uma entidade, adicionar permissões nas roles:

```typescript
// Para ADMIN
`${entity.slug}:manage:all`

// Para MANAGER
`${entity.slug}:read:all`
`${entity.slug}:create:all`
`${entity.slug}:update:team`
`${entity.slug}:delete:team`

// Para USER
`${entity.slug}:read:team`
`${entity.slug}:create:all`
`${entity.slug}:update:own`
`${entity.slug}:delete:own`

// Para VIEWER
`${entity.slug}:read:team`
```

## Checklist

- [ ] Nome singular e plural definidos
- [ ] Slug único no workspace (kebab-case)
- [ ] Ícone do Lucide escolhido
- [ ] Cor hexadecimal definida
- [ ] Campos com tipos corretos
- [ ] Campos obrigatórios marcados
- [ ] Settings com titleField
- [ ] Permissões adicionadas nas roles
- [ ] Dados de exemplo no seed (opcional)
