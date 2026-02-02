'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Bell,
  Shield,
  Key,
  Webhook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateProfile, useChangePassword } from '@/hooks/use-auth';
import Link from 'next/link';

const tabs = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'notifications', label: 'Notificacoes', icon: Bell },
  { id: 'security', label: 'Seguranca', icon: Shield },
  { id: 'api', label: 'Chaves de API', icon: Key },
  { id: 'integrations', label: 'Integracoes', icon: Webhook },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [activeTab, setActiveTab] = useState('profile');

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ name, email });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      return;
    }

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      // Error is handled by the hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
        <Link href="/dashboard" className="hover:underline" data-testid="breadcrumb-dashboard">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground" data-testid="breadcrumb-settings">Configuracoes</span>
      </nav>
      <div>
        <h1 className="text-3xl font-bold" data-testid="settings-heading">Configuracoes</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie suas preferencias e configuracoes de conta
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>
                  Atualize suas informacoes pessoais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-semibold text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <Button variant="outline" size="sm" data-testid="alterar-foto-btn">
                      Alterar Foto
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG ou GIF. Maximo 2MB.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="input-nome-config"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email-config"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <Button onClick={handleSaveProfile} disabled={updateProfile.isPending} data-testid="salvar-config-btn">
                    {updateProfile.isPending ? 'Salvando...' : 'Salvar Alteracoes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notificacoes</CardTitle>
                <CardDescription>
                  Configure como deseja receber notificacoes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Novos registros', desc: 'Quando um novo registro e criado' },
                  { label: 'Atualizacoes', desc: 'Quando um registro e atualizado' },
                  { label: 'Mencoes', desc: 'Quando voce e mencionado' },
                  { label: 'Relatorios', desc: 'Relatorios semanais por email' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <h4 className="font-medium">{item.label}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Seguranca</CardTitle>
                <CardDescription>
                  Gerencie a seguranca da sua conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Alterar Senha</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Senha Atual</Label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nova Senha</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Nova Senha</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-sm text-destructive">As senhas nao coincidem</p>
                      )}
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    >
                      {changePassword.isPending ? 'Alterando...' : 'Alterar Senha'}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Autenticacao de Dois Fatores</h4>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">2FA nao configurado</p>
                      <p className="text-sm text-muted-foreground">
                        Adicione uma camada extra de seguranca
                      </p>
                    </div>
                    <Button variant="outline">Configurar 2FA</Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Sessoes Ativas</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
                      <div>
                        <p className="font-medium text-green-800">Este dispositivo</p>
                        <p className="text-sm text-green-600">Linux - Chrome - Agora</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Atual
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'api' && (
            <Card>
              <CardHeader>
                <CardTitle>Chaves de API</CardTitle>
                <CardDescription>
                  Gerencie suas chaves de API para integracoes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-muted-foreground">
                    Use chaves de API para acessar a API do CRM Builder
                  </p>
                  <Button>
                    <Key className="h-4 w-4 mr-2" />
                    Nova Chave
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Chave de Producao</p>
                        <code className="text-sm text-muted-foreground">
                          crm_live_****************************
                        </code>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Copiar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          Revogar
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Chave de Teste</p>
                        <code className="text-sm text-muted-foreground">
                          crm_test_****************************
                        </code>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Copiar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          Revogar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'integrations' && (
            <Card>
              <CardHeader>
                <CardTitle>Integracoes</CardTitle>
                <CardDescription>
                  Conecte seu CRM a outras ferramentas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'Slack', desc: 'Receba notificacoes no Slack', connected: true },
                  { name: 'Zapier', desc: 'Automatize fluxos de trabalho', connected: false },
                  { name: 'Google Sheets', desc: 'Exporte dados automaticamente', connected: false },
                  { name: 'WhatsApp', desc: 'Integracao com WhatsApp Business', connected: false },
                ].map((integration, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Webhook className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">{integration.name}</h4>
                        <p className="text-sm text-muted-foreground">{integration.desc}</p>
                      </div>
                    </div>
                    <Button variant={integration.connected ? 'outline' : 'default'}>
                      {integration.connected ? 'Configurar' : 'Conectar'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
