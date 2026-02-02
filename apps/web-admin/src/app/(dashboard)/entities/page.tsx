'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash,
  Eye,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import type { Entity } from '@/types';

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    try {
      const response = await api.get('/entities');
      // A API pode retornar { data: [...], meta: {...} } ou um array direto
      const entitiesDate = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setEntities(entitiesDate);
    } catch (error) {
      console.error('Error loading entities:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntities = entities.filter((entity) =>
    (entity.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const fieldTypeColors: Record<string, string> = {
    text: 'bg-blue-100 text-blue-800',
    number: 'bg-green-100 text-green-800',
    email: 'bg-purple-100 text-purple-800',
    date: 'bg-orange-100 text-orange-800',
    boolean: 'bg-pink-100 text-pink-800',
    select: 'bg-yellow-100 text-yellow-800',
    relation: 'bg-indigo-100 text-indigo-800',
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Entities</span>
      </nav>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Entities</h1>
          <p className="text-muted-foreground mt-1">
            Manage your CRM data structures
          </p>
        </div>
        <Link href="/entities/new">
          <Button data-testid="new-entity-btn">
            <Plus className="h-4 w-4 mr-2" />
            New Entity
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search entities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Entities Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/2 mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEntities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entity found</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? 'No entity matches your search.'
                : 'Start by creating your first entity to structure your data.'}
            </p>
            {!search && (
              <Link href="/entities/new">
                <Button data-testid="create-first-entity-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Entity
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((entity) => (
            <Card
              key={entity.id}
              className="group hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{entity.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        /{entity.slug}
                      </p>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {entity.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                    {entity.description}
                  </p>
                )}

                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    {entity.fields.length} fields
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {entity.fields.slice(0, 4).map((field) => (
                      <span
                        key={field.name}
                        className={`text-xs px-2 py-0.5 rounded ${
                          fieldTypeColors[field.type] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {field.label}
                      </span>
                    ))}
                    {entity.fields.length > 4 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                        +{entity.fields.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Link href={`/data?entity=${entity.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" data-testid={`view-data-btn-${entity.id}`}> 
                      <Eye className="h-3 w-3 mr-1" />
                      View Date
                    </Button>
                  </Link>
                  <Link href={`/entities/${entity.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" data-testid={`edit-entity-btn-${entity.id}`}> 
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
