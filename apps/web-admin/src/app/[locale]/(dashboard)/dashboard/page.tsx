'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
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
import { format, formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
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

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recordsOverTime, setRecordsOverTime] = useState<RecordOverTime[]>([]);
  const [entitiesDistribution, setEntitiesDistribution] = useState<EntityDistribution[]>([]);
  const [usersActivity, setUsersActivity] = useState<UserActivity[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardDate = async () => {
    try {
      const [statsRes, recordsRes, distributionRes, usersRes, activityRes] = await Promise.all([
        api.get('/stats/dashboard'),
        api.get('/stats/records-over-time?days=30'),
        api.get('/stats/entities-distribution'),
        api.get('/stats/users-activity?days=7'),
        api.get('/stats/recent-activity?limit=10'),
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
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardDate();
  };

  const statCards = [
    {
      title: 'Entities',
      value: stats?.totalEntities ?? 0,
      icon: <Database className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      href: '/entities',
    },
    {
      title: 'Records',
      value: stats?.totalRecords ?? 0,
      icon: <Layers className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      href: '/data',
    },
    {
      title: 'APIs',
      value: stats?.totalApis ?? 0,
      icon: <Code className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      href: '/apis',
    },
    {
      title: 'Users',
      value: stats?.totalUsers ?? 0,
      icon: <Users className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      href: '/users',
    },
    {
      title: 'Roles',
      value: 0,
      icon: <Activity className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      href: '/roles',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'entity':
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'record':
        return <Layers className="h-4 w-4 text-green-500" />;
      case 'page':
        return <FileText className="h-4 w-4 text-orange-500" />;
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
        return { label: 'Created', color: 'bg-green-500/10 text-green-700' };
      case 'updated':
        return { label: 'Updated', color: 'bg-blue-500/10 text-blue-700' };
      case 'deleted':
        return { label: 'Deleted', color: 'bg-red-500/10 text-red-700' };
      default:
        return { label: action, color: 'bg-gray-500/10 text-gray-700' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-96 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
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
    <div className="space-y-8" data-testid="dashboard-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="dashboard-heading">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Welcome back, {user?.name?.split(' ')[0]}! Here's a summary of your CRM.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} data-testid="refresh-btn" className="w-full sm:w-auto">
          <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
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
            <CardTitle>Records in the Last 30 Days</CardTitle>
            <CardDescription>Evolution of records created</CardDescription>
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
                    tickFormatter={(value) => format(new Date(value), 'MM/dd', { locale: enUS })}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    labelFormatter={(value) =>
                      format(new Date(value), "MMMM dd", { locale: enUS })
                    }
                    formatter={(value: number) => [value, 'Records']}
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
                  <p>No records created yet</p>
                  <Link href="/data">
                    <Button variant="link" className="mt-2">
                      Create first record
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
            <CardTitle>Distribution by Entity</CardTitle>
            <CardDescription>Number of records per entity</CardDescription>
          </CardHeader>
          <CardContent>
            {entitiesDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={entitiesDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="records"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={true}
                  >
                    {entitiesDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString('en-US')} records`,
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
                  <p>No entities created yet</p>
                  <Link href="/entities">
                    <Button variant="link" className="mt-2">
                      Create first entity
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
              Recent Activity
            </CardTitle>
            <CardDescription>Latest actions performed in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => {
                  const actionInfo = getActionLabel(activity.action);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        {getActivityIcon(activity.type)}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={actionInfo.color}>
                              {actionInfo.label}
                            </Badge>
                            <span className="font-medium">{activity.name}</span>
                          </div>
                          {activity.entityName && (
                            <span className="text-xs text-muted-foreground">
                              em {activity.entityName}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                          locale: enUS,
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activity recorded</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Users
            </CardTitle>
            <CardDescription>Latest user logins</CardDescription>
          </CardHeader>
          <CardContent>
            {usersActivity.length > 0 ? (
              <div className="space-y-4">
                {usersActivity.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {user.lastLoginAt ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(user.lastLoginAt), {
                              addSuffix: true,
                              locale: enUS,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm')}
                          </p>
                        </>
                      ) : (
                        <Badge variant="outline">Never logged in</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users registered</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Start building your CRM</CardDescription>
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
                      <h3 className="font-semibold text-sm sm:text-base">New Entity</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        Define a data structure
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
                      <h3 className="font-semibold text-sm sm:text-base">Manage Data</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        View and manage records
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
                      <h3 className="font-semibold text-sm sm:text-base">New API</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        Configure an endpoint
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
                      <h3 className="font-semibold text-sm sm:text-base">Manage Users</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        Add team members
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
