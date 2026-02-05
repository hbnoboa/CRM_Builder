'use client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/ui/loading-page';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import React, { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Email invalid'),
});

type FormDate = z.infer<typeof schema>;

export default function ProfilePage() {
  const [loading, setLoading] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (form: FormDate) => {
      await api.put('/users/me', form);
    },
  });

  const onSubmit = (data: FormDate) => {
    mutation.mutate(data, {
      onSuccess: () => toast.success('Profile atualizado com sucesso!'),
      onError: () => toast.error('Error updating profile'),
    });
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormDate>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (data) reset({ name: data.name, email: data.email });
  }, [data, reset]);

  return (
    <ErrorBoundary>
      <div className="max-w-lg mx-auto mt-8">
        {/* Breadcrumbs */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
          <Link href="/dashboard" className="hover:underline" data-testid="breadcrumb-dashboard">Dashboard</Link>
          <span>/</span>
          <span className="font-semibold text-foreground" data-testid="breadcrumb-profile">Profile</span>
        </nav>
        {/* Back */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="mb-2" aria-label="Back to dashboard" data-testid="voltar-dashboard-btn">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Back to dashboard</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {isLoading ? (
          <LoadingPage />
        ) : isError || !data ? (
          <EmptyState message="Profile not found." />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle data-testid="profile-heading">My Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <Input
                    placeholder="Name"
                    {...register('name')}
                    disabled={mutation.isPending}
                    data-testid="input-name-profile"
                  />
                  {errors.name && (
                    <span className="text-xs text-red-500">{errors.name.message}</span>
                  )}
                </div>
                <div>
                  <Input
                    placeholder="Email"
                    {...register('email')}
                    disabled={mutation.isPending}
                    data-testid="input-email-profile"
                  />
                  {errors.email && (
                    <span className="text-xs text-red-500">{errors.email.message}</span>
                  )}
                </div>
                <Button type="submit" disabled={mutation.isPending} data-testid="save-profile-btn">
                  {mutation.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}
