# 🎨 Padrões de Código

## TypeScript

### Naming
```typescript
// Interfaces: PascalCase, prefixo opcional "I"
interface User { }
interface CreateUserDto { }

// Types: PascalCase
type UserRole = 'ADMIN' | 'USER';

// Enums: PascalCase, valores UPPER_SNAKE
enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

// Classes: PascalCase
class UserService { }

// Funções: camelCase
function createUser() { }
async function findAllUsers() { }

// Variáveis: camelCase
const userName = 'João';
let isLoading = false;

// Constantes: UPPER_SNAKE ou camelCase
const API_URL = 'http://...';
const defaultPageSize = 20;

// Arquivos: kebab-case
user.service.ts
create-user.dto.ts
permission-gate.tsx
```

### Imports
```typescript
// 1. Imports externos
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

// 2. Imports internos absolutos
import { PrismaService } from '@/prisma/prisma.service';

// 3. Imports relativos
import { CreateUserDto } from './dto/create-user.dto';
```

### Tipos
```typescript
// ✅ Bom: tipos explícitos
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Ruim: any
function processData(data: any) { }

// ✅ Bom: generics quando necessário
function findById<T>(id: string): Promise<T | null> { }
```

## NestJS

### Controllers
```typescript
@Controller('users')
@ApiTags('Users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários' })
  @RequirePermission('user', 'read', 'all')
  async findAll(@Query() query: PaginationDto) {
    return this.userService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Cria usuário' })
  @RequirePermission('user', 'create')
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}
```

### Services
```typescript
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: PaginationDto) {
    const { page = 1, limit = 20, search } = query;

    const where: Prisma.UserWhereInput = {
      tenantId, // SEMPRE filtrar por tenant
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

### DTOs
```typescript
import { IsString, IsEmail, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
```

## React/Next.js

### Componentes
```typescript
// components/user-card.tsx
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  onDelete?: (id: string) => void;
}

export function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Avatar>
          <AvatarImage src={user.avatar} />
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-medium">{user.name}</h3>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        {onEdit && (
          <Button variant="ghost" size="icon" onClick={() => onEdit(user)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### Hooks
```typescript
// hooks/use-users.ts
export function useUsers(params?: UsersParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => userService.findAll(params),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
```

### Pages
```typescript
// app/(dashboard)/users/page.tsx
export default function UsersPage() {
  const { data, isLoading } = useUsers();
  const { can } = usePermission();

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <PermissionGate resource="user" action="create">
          <Button asChild>
            <Link href="/users/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} />
    </div>
  );
}
```

## CSS/Tailwind

### Ordem das classes
```tsx
// 1. Layout (display, position)
// 2. Spacing (margin, padding)
// 3. Size (width, height)
// 4. Background/Border
// 5. Typography
// 6. Effects (shadow, opacity)
// 7. States (hover, focus)
// 8. Responsive

<div className="flex items-center justify-between p-4 w-full bg-card border rounded-lg text-sm shadow-sm hover:shadow-md transition-shadow md:p-6">
```

### Componentização
```tsx
// ✅ Bom: usar cn() para merge de classes
<Button className={cn("w-full", className)}>

// ✅ Bom: variantes com cva()
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```
