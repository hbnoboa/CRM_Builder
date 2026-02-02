# 🧩 Skill: Criar Componente

## Quando Usar
Quando precisar criar um componente React reutilizável.

## Passos

### 1. Decidir Localização

```
components/
├── ui/          # Componentes base (button, input, card)
├── shared/      # Componentes do app (user-card, entity-list)
└── [feature]/   # Componentes específicos de feature
```

### 2. Estrutura do Arquivo

```typescript
// components/shared/user-card.tsx

// 1. Imports
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// 2. Types/Interfaces
interface UserCardProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

// 3. Componente
export function UserCard({ 
  user, 
  onEdit, 
  onDelete, 
  className 
}: UserCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar>
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{user.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {user.email}
          </p>
        </div>
        
        <div className="flex gap-1">
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. Checklist

- [ ] Props tipadas com interface
- [ ] Aceita `className` para customização
- [ ] Usa `cn()` para merge de classes
- [ ] Componentes internos do shadcn/ui
- [ ] Ícones do Lucide React
- [ ] Nomes descritivos
- [ ] Export nomeado (não default)

### 4. Variantes (se necessário)

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const userCardVariants = cva(
  'rounded-lg border transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-card',
        highlighted: 'bg-accent border-accent',
      },
      size: {
        sm: 'p-2',
        default: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface UserCardProps extends VariantProps<typeof userCardVariants> {
  // ...
}

export function UserCard({ variant, size, ...props }: UserCardProps) {
  return (
    <Card className={cn(userCardVariants({ variant, size }))}>
      {/* ... */}
    </Card>
  );
}
```

### 5. Com Estado/Hooks

```typescript
export function UserCard({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUser(userId);
  
  if (isLoading) {
    return <UserCardSkeleton />;
  }
  
  if (!user) {
    return null;
  }
  
  return (
    <Card>
      {/* ... */}
    </Card>
  );
}

// Skeleton component
function UserCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
```
