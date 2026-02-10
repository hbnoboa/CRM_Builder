'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Users,
  Database,
  Code,
  Activity,
  Layers,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, formatDistanceToNow, Locale } from 'date-fns';
import { enUS, ptBR, es } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface DashboardStats {
  totalEntities: number;
  totalRecords: number;
  totalPages: number;
  totalApis: number;
  totalUsers: number;
}

interface RecordOverTime {
  date: string;
  count: number;
}

interface EntityDistribution {
  name: string;
  slug: string;
  records: number;
}

interface UserActivity {
  id: string;
  name: string;
  email: string;
  lastLoginAt: string | null;
}

interface RecentActivity {
  id: string;
  type: 'entity' | 'record' | 'page' | 'api' | 'user';
  action: 'created' | 'updated' | 'deleted';
  name: string;
  timestamp: string;
  entityName?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const dateLocales: Record<string, Locale> = {
  'pt-BR': ptBR,
  'en': enUS,
  'es': es,
};

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const locale = useLocale();
  const dateLocale = dateLocales[locale] || enUS;
  const { user } = useAuthStore();
  const { effectiveTenantId } = useTenant();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recordsOverTime, setRecordsOverTime] = useState<RecordOverTime[]>([]);
  const [entitiesDistribution, setEntitiesDistribution] = useState<EntityDistribution[]>([]);
  const [usersActivity, setUsersActivity] = useState<UserActivity[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardDate = async () => {
    try {
      const params: Record<string, string> = {};
      if (effectiveTenantId) params.tenantId = effectiveTenantId;
      const [statsRes, recordsRes, distributionRes, usersRes, activityRes] = await Promise.all([
        api.get('/stats/dashboard', { params }),
        api.get('/stats/records-over-time', { params: { days: 30, ...params } }),
        api.get('/stats/entities-distribution', { params }),
        api.get('/stats/users-activity', { params: { days: 7, ...params } }),
        api.get('/stats/recent-activity', { params: { limit: 10, ...params } }),
      ]);

      setStats(statsRes.data);
      setRecordsOverTime(recordsRes.data);
      setEntitiesDistribution(distributionRes.data);
      setUsersActivity(usersRes.data);
      setRecentActivity(activityRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Dados de fallback
      setStats({
        totalEntities: 0,
        totalRecords: 0,
        totalPages: 0,
        totalApis: 0,
        totalUsers: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardDate();
  }, [effectiveTenantId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardDate();
  };

  const statCards = [
    {
      title: t('stats.entities'),
      value: stats?.totalEntities ?? 0,
      icon: <Database className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      href: '/entities',
    },
    {
      title: t('stats.records'),
      value: stats?.totalRecords ?? 0,
      icon: <Layers className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      href: '/data',
    },
    {
      title: t('stats.apis'),
      value: stats?.totalApis ?? 0,
      icon: <Code className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      href: '/apis',
    },
    {
      title: t('stats.users'),
      value: stats?.totalUsers ?? 0,
      icon: <Users className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      href: '/users',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'entity':
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'record':
        return <Layers className="h-4 w-4 text-green-500" />;
      case 'api':
        return <Code className="h-4 w-4 text-purple-500" />;
      case 'user':
        return <Users className="h-4 w-4 text-pink-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created':
        return { label: t('activity.created'), color: 'bg-green-500/10 text-green-700' };
      case 'updated':
        return { label: t('activity.updated'), color: 'bg-blue-500/10 text-blue-700' };
      case 'deleted':
        return { label: t('activity.deleted'), color: 'bg-red-500/10 text-red-700' };
      default:
        return { label: action, color: 'bg-gray-500/10 text-gray-700' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-8">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-full max-w-96 mt-2" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8" data-testid="dashboard-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="dashboard-heading">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('welcome', { name: user?.name?.split(' ')[0] ?? '' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} data-testid="refresh-btn" className="w-full sm:w-auto">
          <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
          {tCommon('refresh')}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map((stat, index) => (
          <Link key={index} href={stat.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor}`}>
                    <div className={stat.color}>{stat.icon}</div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold">{stat.value.toLocaleString('en-US')}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Records Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>{t('charts.recordsLast30Days')}</CardTitle>
            <CardDescription>{t('charts.recordsEvolution')}</CardDescription>
          </CardHeader>
          <CardContent>
            {recordsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={recordsOverTime}>
                  <defs>
                    <linearGradient id="colorRecords" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MM/dd', { locale: dateLocale })}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    labelFormatter={(value) =>
                      format(new Date(value), "MMMM dd", { locale: dateLocale })
                    }
                    formatter={(value) => [value, t('stats.records')]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRecords)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('empty.noRecords')}</p>
                  <Link href="/data">
                    <Button variant="link" className="mt-2">
                      {t('empty.createFirstRecord')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Entities Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t('charts.distributionByEntity')}</CardTitle>
            <CardDescription>{t('charts.recordsPerEntity')}</CardDescription>
          </CardHeader>
          <CardContent>
            {entitiesDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={entitiesDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="records"
                    nameKey="name"
                  >
                    {entitiesDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                  <Tooltip
                    formatter={(value, name) => [
                      `${Number(value).toLocaleString(locale)} ${t('stats.records').toLowerCase()}`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('empty.noEntities')}</p>
                  <Link href="/entities">
                    <Button variant="link" className="mt-2">
                      {t('empty.createFirstEntity')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('activity.title')}
            </CardTitle>
            <CardDescription>{t('activity.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => {
                  const actionInfo = getActionLabel(activity.action);
                  return (
                    <div
                      key={activity.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getActivityIcon(activity.type)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className={actionInfo.color}>
                              {actionInfo.label}
                            </Badge>
                            <span className="font-medium truncate">{activity.name}</span>
                          </div>
                          {activity.entityName && (
                            <span className="text-xs text-muted-foreground">
                              {t('activity.in')} {activity.entityName}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('activity.noActivity')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('activeUsers.title')}
            </CardTitle>
            <CardDescription>{t('activeUsers.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {usersActivity.length > 0 ? (
              <div className="space-y-4">
                {usersActivity.map((activityUser) => (
                  <div
                    key={activityUser.id}
                    className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs sm:text-sm font-medium text-primary">
                          {activityUser.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{activityUser.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{activityUser.email}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {activityUser.lastLoginAt ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(activityUser.lastLoginAt), {
                              addSuffix: true,
                              locale: dateLocale,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(activityUser.lastLoginAt), 'dd/MM/yyyy HH:mm')}
                          </p>
                        </>
                      ) : (
                        <Badge variant="outline">{t('activeUsers.neverLoggedIn')}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('activeUsers.noUsers')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickActions.title')}</CardTitle>
          <CardDescription>{t('quickActions.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Link href="/entities/new">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 rounded-lg bg-blue-500/10 flex-shrink-0">
                      <Database className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base">{t('quickActions.newEntity')}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {t('quickActions.newEntityDesc')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/data">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 rounded-lg bg-orange-500/10 flex-shrink-0">
                      <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base">{tNav('data')}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {t('quickActions.newPageDesc')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/apis/new">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 rounded-lg bg-purple-500/10 flex-shrink-0">
                      <Code className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base">{t('quickActions.newApi')}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {t('quickActions.newApiDesc')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/users">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 rounded-lg bg-pink-500/10 flex-shrink-0">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-pink-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base">{t('quickActions.manageUsers')}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {t('quickActions.manageUsersDesc')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
