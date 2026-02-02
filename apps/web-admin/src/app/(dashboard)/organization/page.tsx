'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Shield,
  CreditCard,
  Globe,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateOrganization } from '@/hooks/use-organizations';
import Link from 'next/link';

export default function OrganizationPage() {
  const { user, getProfile } = useAuthStore();
  const updateOrganization = useUpdateOrganization();

  const [orgName, setOrgName] = useState(user?.organization?.name || '');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    if (user?.organization?.name) {
      setOrgName(user.organization.name);
    }
  }, [user?.organization?.name]);

  const handleSave = async () => {
    if (!user?.organization?.id) return;

    try {
      await updateOrganization.mutateAsync({
        id: user.organization.id,
        data: {
          name: orgName,
        },
      });
      // Refresh user data to update the sidebar/header
      await getProfile();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Organization</span>
      </nav>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" data-testid="page-title">Organization</h1>
        <p className="text-muted-foreground mt-1">
          Configure your organization and workspaces
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sidebar / Quick Stats */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{user?.organization?.name}</h3>
                  <p className="text-sm text-muted-foreground">/{user?.organization?.slug}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tenant</span>
                <span className="font-medium">{user?.tenant?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="font-medium text-primary">Pro</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-green-600 font-medium">Active</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild data-testid="manage-users-btn">
                  <Link href="/users">
                    <Users className="h-4 w-4 mr-2" />
                    Gerenciar Usuarios
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild data-testid="permissions-btn">
                  <Link href="/roles">
                    <Shield className="h-4 w-4 mr-2" />
                    Permissoes
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="billing-btn">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Faturamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Basic information about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={user?.organization?.slug}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Custom Domain</Label>
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    placeholder="crm.suaempresa.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" data-testid="configure-domain-btn">
                    <Globe className="h-4 w-4 mr-2" />
                    Configurar
                  </Button>
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={handleSave} disabled={updateOrganization.isPending} data-testid="save-org-btn">
                  {updateOrganization.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle>Customization</CardTitle>
              <CardDescription>
                Configure the appearance of your CRM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Palette className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drag an image or click to upload
                    </p>
                    <Button variant="outline" size="sm" className="mt-2" data-testid="upload-logo-btn">
                      Enviar Logo
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <div className="w-10 h-10 rounded-lg bg-primary" />
                      <Input defaultValue="#1a1a1a" className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <div className="w-10 h-10 rounded-lg bg-secondary" />
                      <Input defaultValue="#f5f5f5" className="flex-1" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg">
                <div>
                  <h4 className="font-medium">Delete Organization</h4>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone
                  </p>
                </div>
                <Button variant="destructive" data-testid="delete-org-btn">Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
