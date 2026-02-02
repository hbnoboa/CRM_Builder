'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Save, Eye, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { puckConfig, initialData } from '@/lib/puck-config';
import api from '@/lib/api';
import type { Data } from '@measured/puck';

// Dynamic import for Puck to avoid SSR issues
const Puck = dynamic(
  () => import('@measured/puck').then((mod) => mod.Puck),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-screen">Loading editor...</div> }
);

// Import Puck CSS
import '@measured/puck/puck.css';

export default function NewPageEditor() {
  const router = useRouter();
  const [pageTitle, setPageTitle] = useState('New Page');
  const [pageSlug, setPageSlug] = useState('new-page');
  const [pageDescription, setPageDescription] = useState('');
  const [data, setData] = useState<Data>(initialData);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleSave = useCallback(async (puckData: Data) => {
    setSaving(true);
    try {
      await api.post('/pages', {
        title: pageTitle,
        slug: pageSlug,
        description: pageDescription,
        content: puckData,
        isPublished: false,
      });
      
      router.push('/pages');
    } catch (error: any) {
      console.error('Error saving:', error);
      const message = error.response?.data?.message || 'Error saving page';
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [pageTitle, pageSlug, pageDescription, router]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b bg-background flex items-center px-4 gap-4">
        <Link href="/pages">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <div className="flex-1 flex items-center gap-4">
          <Input
            value={pageTitle}
            onChange={(e) => {
              setPageTitle(e.target.value);
              setPageSlug(generateSlug(e.target.value));
            }}
            placeholder="Page title"
            className="max-w-xs"
          />
          <span className="text-sm text-muted-foreground">/{pageSlug}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave(data)}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b bg-muted/50 p-4">
          <div className="max-w-2xl mx-auto grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title da Page</Label>
              <Input
                id="title"
                value={pageTitle}
                onChange={(e) => {
                  setPageTitle(e.target.value);
                  setPageSlug(generateSlug(e.target.value));
                }}
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                value={pageSlug}
                onChange={(e) => setPageSlug(generateSlug(e.target.value))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Puck Editor */}
      <div className="flex-1 overflow-hidden">
        <Puck
          config={puckConfig}
          data={data}
          onPublish={handleSave}
          onChange={setData}
        />
      </div>
    </div>
  );
}
