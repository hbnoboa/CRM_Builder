# 🎨 Componentes UI

## Base: shadcn/ui

Todos os componentes base vêm do shadcn/ui (Radix + Tailwind).

### Componentes Disponíveis

| Componente | Localização | Uso |
|------------|-------------|-----|
| Button | `components/ui/button.tsx` | Botões de ação |
| Input | `components/ui/input.tsx` | Campos de texto |
| Label | `components/ui/label.tsx` | Labels para inputs |
| Card | `components/ui/card.tsx` | Containers com borda |
| Dialog | `components/ui/dialog.tsx` | Modais |
| Dropdown Menu | `components/ui/dropdown-menu.tsx` | Menus dropdown |
| Avatar | `components/ui/avatar.tsx` | Fotos de usuário |
| Badge | `components/ui/badge.tsx` | Tags/status |
| Separator | `components/ui/separator.tsx` | Linhas divisórias |
| Scroll Area | `components/ui/scroll-area.tsx` | Scroll customizado |
| Tooltip | `components/ui/tooltip.tsx` | Dicas de hover |
| Progress | `components/ui/progress.tsx` | Barras de progresso |
| Popover | `components/ui/popover.tsx` | Popovers |
| Slot | `components/ui/slot.tsx` | Composição |

## Componentes do App

### Workspace Switcher
```tsx
// components/workspace-switcher.tsx
<WorkspaceSwitcher />
```
Permite trocar entre workspaces do usuário.

### Notification Bell
```tsx
// components/notifications/notification-bell.tsx
<NotificationBell />
```
Mostra notificações em tempo real via WebSocket.

## Padrões de Uso

### Botões
```tsx
// Primário
<Button>Salvar</Button>

// Secundário
<Button variant="outline">Cancelar</Button>

// Destructive
<Button variant="destructive">Excluir</Button>

// Ghost
<Button variant="ghost">
  <Icon className="h-4 w-4" />
</Button>

// Com loading
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Salvar
</Button>
```

### Cards
```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>
    Conteúdo
  </CardContent>
  <CardFooter>
    <Button>Ação</Button>
  </CardFooter>
</Card>
```

### Dialogs
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Abrir</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
      <DialogDescription>Descrição</DialogDescription>
    </DialogHeader>
    <div>Conteúdo</div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit}>Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Forms (React Hook Form + Zod)
```tsx
const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-500">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
        
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
```

### Data Tables (TanStack Table)
```tsx
// Ver implementação em components/ui/data-table.tsx

<DataTable
  columns={columns}
  data={data}
  searchKey="name"
  pagination
/>
```

## Ícones

Usamos **Lucide React**:

```tsx
import { 
  Users, 
  Settings, 
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  ChevronDown,
  Loader2 
} from 'lucide-react';

<Users className="h-4 w-4" />
```

## Classes Úteis

```tsx
// Centralizar
className="flex items-center justify-center"

// Gap entre elementos
className="flex gap-2"

// Espaçamento vertical
className="space-y-4"

// Grid responsivo
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// Texto truncado
className="truncate"

// Hover
className="hover:bg-accent"

// Transição
className="transition-colors"
```

## Cores do Tema

```css
/* Definidas em globals.css */
--background
--foreground
--card
--card-foreground
--primary
--primary-foreground
--secondary
--secondary-foreground
--muted
--muted-foreground
--accent
--accent-foreground
--destructive
--destructive-foreground
--border
--input
--ring
```
