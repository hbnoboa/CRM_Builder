'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Bell,
  Shield,
  Key,
  Webhook,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateProfile, useChangePassword } from '@/hooks/use-auth';
import { Link } from '@/i18n/navigation';

const TAB_IDS = ['profile', 'notifications', 'security', 'api', 'integrations'] as const;
const TAB_ICONS = {
  profile: User,
  notifications: Bell,
  security: Shield,
  api: Key,
  integrations: Webhook,
};

function SettingsPageContent() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { user } = useAuthStore();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [activeTab, setActiveTab] = useState<typeof TAB_IDS[number]>('profile');

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
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
        <Link href="/dashboard" className="hover:underline" data-testid="breadcrumb-dashboard">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground" data-testid="breadcrumb-settings">{tNav('settings')}</span>
      </nav>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="settings-heading">{t('title')}</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar Tabs */}
        <div className="flex md:flex-col md:w-64 gap-1 overflow-x-auto pb-2 md:pb-0 md:overflow-x-visible">
          {TAB_IDS.map((tabId) => {
            const Icon = TAB_ICONS[tabId];
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-left transition-colors whitespace-nowrap text-sm md:text-base md:w-full ${
                  activeTab === tabId
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
                data-testid={`tab-${tabId}`}
              >
                <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                {t(`tabs.${tabId}`)}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.title')}</CardTitle>
                <CardDescription>
                  {t('profile.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xl sm:text-2xl font-semibold text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-center sm:text-left">
                    <Button variant="outline" size="sm" data-testid="alterar-foto-btn">
                      {t('profile.changePhoto')}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('profile.photoHint')}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('profile.fullName')}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="input-nome-config"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('profile.email')}</Label>
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
                  <Button className="w-full sm:w-auto" onClick={handleSaveProfile} disabled={updateProfile.isPending} data-testid="salvar-config-btn">
                    {updateProfile.isPending ? tCommon('saving') : t('profile.saveChanges')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('notifications.title')}</CardTitle>
                <CardDescription>
                  {t('notifications.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(['newRecords', 'updates', 'mentions', 'reports'] as const).map((key) => (
                  <div
                    key={key}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg"
                  >
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm sm:text-base">{t(`notifications.${key}.label`)}</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground">{t(`notifications.${key}.desc`)}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-center">
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
                <CardTitle>{t('security.title')}</CardTitle>
                <CardDescription>
                  {t('security.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">{t('security.changePassword')}</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>{t('security.currentPassword')}</Label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('security.newPassword')}</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('security.confirmNewPassword')}</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-sm text-destructive">{t('security.passwordsNotMatch')}</p>
                      )}
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    >
                      {changePassword.isPending ? t('security.changing') : t('security.changePassword')}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">{t('security.twoFactor')}</h4>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg">
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base">{t('security.twoFactorNotConfigured')}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {t('security.twoFactorHint')}
                      </p>
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto shrink-0">{t('security.setup2FA')}</Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">{t('security.activeSessions')}</h4>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg bg-green-50">
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base text-green-800">{t('security.thisDevice')}</p>
                        <p className="text-xs sm:text-sm text-green-600">{t('security.deviceInfo')}</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded self-start sm:self-center shrink-0">
                        {t('security.current')}
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
                <CardTitle>{t('apiKeys.title')}</CardTitle>
                <CardDescription>
                  {t('apiKeys.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {t('apiKeys.hint')}
                  </p>
                  <Button className="w-full sm:w-auto shrink-0">
                    <Key className="h-4 w-4 mr-2" />
                    {t('apiKeys.newKey')}
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <div className="p-3 sm:p-4 border-b">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base">{t('apiKeys.productionKey')}</p>
                        <code className="text-xs sm:text-sm text-muted-foreground break-all">
                          crm_live_****************************
                        </code>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm">{tCommon('copy')}</Button>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          {t('apiKeys.revoke')}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base">{t('apiKeys.testKey')}</p>
                        <code className="text-xs sm:text-sm text-muted-foreground break-all">
                          crm_test_****************************
                        </code>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm">{tCommon('copy')}</Button>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          {t('apiKeys.revoke')}
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
                <CardTitle>{t('integrations.title')}</CardTitle>
                <CardDescription>
                  {t('integrations.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(['slack', 'zapier', 'googleSheets', 'whatsapp'] as const).map((key) => {
                  const isConnected = key === 'slack';
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Webhook className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm sm:text-base">{t(`integrations.${key}.name`)}</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{t(`integrations.${key}.desc`)}</p>
                        </div>
                      </div>
                      <Button className="w-full sm:w-auto shrink-0" variant={isConnected ? 'outline' : 'default'}>
                        {isConnected ? t('integrations.configure') : t('integrations.connect')}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireRole adminOnly>
      <SettingsPageContent />
    </RequireRole>
  );
}
