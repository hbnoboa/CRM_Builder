'use client';

import { useState, useEffect } from 'react';
import { User, Languages, Palette } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateProfile, useChangePassword } from '@/hooks/use-auth';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const TAB_IDS = ['profile', 'language', 'theme'] as const;
const TAB_ICONS = {
  profile: User,
  language: Languages,
  theme: Palette,
};

const LANGUAGES = [
  { code: 'pt-BR', name: 'Portugues (Brasil)', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Espanol', flag: '🇪🇸' },
];

function SettingsPageContent() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { user } = useAuthStore();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<typeof TAB_IDS[number]>('profile');
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  // Profile form state
  const [name, setName] = useState(user?.name || '');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ name });
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

  const handleLanguageChange = (langCode: string) => {
    router.replace(pathname, { locale: langCode });
  };

  const handleTabClick = (tabId: typeof TAB_IDS[number]) => {
    if (tabId === 'theme') {
      setThemeModalOpen(true);
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{tNav('settings')}</span>
      </nav>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar Tabs */}
        <div className="flex md:flex-col md:w-64 gap-1 overflow-x-auto pb-2 md:pb-0 md:overflow-x-visible">
          {TAB_IDS.map((tabId) => {
            const Icon = TAB_ICONS[tabId];
            const isActive = activeTab === tabId && tabId !== 'theme';
            return (
              <button
                key={tabId}
                onClick={() => handleTabClick(tabId)}
                className={cn(
                  'flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-left transition-colors whitespace-nowrap text-sm md:text-base md:w-full',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
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
            <div className="space-y-6">
              {/* Profile Card */}
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
                      <p className="font-medium">{user?.name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">{t('profile.fullName')}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={updateProfile.isPending || name === user?.name}
                    >
                      {updateProfile.isPending ? tCommon('saving') : tCommon('save')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Password Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('security.changePassword')}</CardTitle>
                  <CardDescription>
                    {t('security.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  <div className="pt-2">
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    >
                      {changePassword.isPending ? tCommon('saving') : t('security.changePassword')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'language' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('language.title')}</CardTitle>
                <CardDescription>
                  {t('language.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                      locale === lang.code
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="font-medium">{lang.name}</span>
                    {locale === lang.code && (
                      <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                        {tCommon('active')}
                      </span>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Theme Modal */}
      <Dialog open={themeModalOpen} onOpenChange={setThemeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('theme.title')}
            </DialogTitle>
            <DialogDescription className="pt-4 text-center">
              <div className="py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Palette className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">
                  {t('theme.comingSoon')}
                </p>
                <p className="text-muted-foreground">
                  {t('theme.comingSoonDesc')}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireRole module="settings">
      <SettingsPageContent />
    </RequireRole>
  );
}
