'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash,
  Code,
  Play,
  Pause,
  Copy,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import api from '@/lib/api';

interface CustomApi {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  isActive: boolean;
  createdAt: string;
}

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
};

export default function ApisPage() {
  const [apis, setApis] = useState<CustomApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadApis();
  }, []);

  const loadApis = async () => {
    try {
      const response = await api.get<CustomApi[]>('/custom-apis');
      setApis(response.data);
    } catch (error) {
      console.error('Error loading APIs:', error);
      // Mock data for demo
      setApis([
        {
          id: '1',
          name: 'Get VIP Customers',
          path: '/vip-customers',
          method: 'GET',
          description: 'Returns all customers with VIP status',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Create Lead',
          path: '/leads',
          method: 'POST',
          description: 'Creates a new lead in the system',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'Payment Webhook',
          path: '/webhook/payment',
          method: 'POST',
          description: 'Receives payment notifications',
          isActive: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredApis = apis.filter(
    (api) =>
      api.name.toLowerCase().includes(search.toLowerCase()) ||
      api.path.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
        <Link href="/dashboard" className="hover:underline" data-testid="breadcrumb-dashboard">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground" data-testid="breadcrumb-apis">APIs</span>
      </nav>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="apis-heading">Custom APIs</h1>
          <p className="text-muted-foreground mt-1">
            Create custom endpoints for your CRM
          </p>
        </div>
        <Link href="/apis/new">
          <Button data-testid="nova-api-btn">
            <Plus className="h-4 w-4 mr-2" />
            New API
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{apis.length}</div>
            <p className="text-sm text-muted-foreground">Total APIs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {apis.filter((a) => a.isActive).length}
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {apis.filter((a) => a.method === 'GET').length}
            </div>
            <p className="text-sm text-muted-foreground">Endpoints GET</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {apis.filter((a) => a.method === 'POST').length}
            </div>
            <p className="text-sm text-muted-foreground">Endpoints POST</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search APIs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="search-apis-input"
        />
      </div>

      {/* APIs List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/3 mb-4" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredApis.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API found</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? 'No API matches your search.'
                : 'Create your first custom API to get started.'}
            </p>
            {!search && (
              <Link href="/apis/new">
                <Button data-testid="criar-first-api-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First API
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredApis.map((apiItem) => (
            <Card
              key={apiItem.id}
              className="hover:border-primary/50 transition-colors"
              data-testid={`api-card-${apiItem.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" data-testid={`api-title-${apiItem.id}`}>{apiItem.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            methodColors[apiItem.method]
                          }`}
                          data-testid={`api-method-${apiItem.id}`}
                        >
                          {apiItem.method}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            apiItem.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                          data-testid={`api-status-${apiItem.id}`}
                        >
                          {apiItem.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          /api/x/[workspace]{apiItem.path}
                        </code>
                        <button className="text-muted-foreground hover:text-foreground" data-testid={`copy-api-path-btn-${apiItem.id}`}>
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      {apiItem.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {apiItem.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" data-testid={`test-api-btn-${apiItem.id}`}>
                      <Play className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                    <Link href={`/apis/${apiItem.id}`}>
                      <Button variant="outline" size="sm" data-testid={`edit-api-btn-${apiItem.id}`}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" data-testid={`more-api-btn-${apiItem.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
