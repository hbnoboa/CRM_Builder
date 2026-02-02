# 📄 Skill: Criar Página

## Quando Usar
Quando precisar criar uma nova página no frontend Next.js.

## Passos

### 1. Criar Arquivo de Página

```typescript
// app/(dashboard)/[nome]/page.tsx

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Título da Página',
};

export default function NomeDaPaginaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Título</h1>
      </div>
      
      {/* Conteúdo */}
    </div>
  );
}
```

### 2. Página com Dados (Client Component)

```typescript
// app/(dashboard)/produtos/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { productService } from '@/services/product.service';
import { columns } from './columns';

export default function ProdutosPage() {
  const [search, setSearch] = useState('');
  
  const { data, isLoading } = useQuery({
    queryKey: ['produtos', { search }],
    queryFn: () => productService.findAll({ search }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabela */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### 3. Página de Detalhes (com params)

```typescript
// app/(dashboard)/produtos/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { productService } from '@/services/product.service';

export default function ProdutoDetalhesPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: produto, isLoading } = useQuery({
    queryKey: ['produto', id],
    queryFn: () => productService.findOne(id),
    enabled: !!id,
  });

  if (isLoading) {
    return <ProdutoSkeleton />;
  }

  if (!produto) {
    return <div>Produto não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/produtos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{produto.nome}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Dados do produto */}
        </CardContent>
      </Card>
    </div>
  );
}

function ProdutoSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4. Página com Form

```typescript
// app/(dashboard)/produtos/novo/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { productService } from '@/services/product.service';

const schema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
  preco: z.number().min(0, 'Preço inválido'),
});

type FormData = z.infer<typeof schema>;

export default function NovoProdutoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: productService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast.success('Produto criado!');
      router.push('/produtos');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/produtos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Novo Produto</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Produto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" {...form.register('nome')} />
              {form.formState.errors.nome && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.nome.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="preco">Preço</Label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                {...form.register('preco', { valueAsNumber: true })}
              />
            </div>

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5. Adicionar no Sidebar (se necessário)

```typescript
// lib/constants/menu-items.ts
export const menuItems = [
  // ...
  {
    title: 'Produtos',
    href: '/produtos',
    icon: Package,
    permission: 'produto:read',
  },
];
```

## Checklist

- [ ] Arquivo em `app/(dashboard)/[nome]/page.tsx`
- [ ] Metadata com title definido
- [ ] Loading state (skeleton)
- [ ] Error handling
- [ ] Permissões verificadas (PermissionGate)
- [ ] Responsivo (mobile-first)
- [ ] Navegação (links, voltar)
- [ ] Adicionado no sidebar (se aplicável)
