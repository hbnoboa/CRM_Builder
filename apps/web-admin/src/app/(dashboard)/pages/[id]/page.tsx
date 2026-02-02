'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Settings,
  Layers,
  Palette,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Puck, Data } from '@measured/puck';
import { puckConfig } from '@/lib/puck-config';
import api from '@/lib/api';
import '@measured/puck/puck.css';

const defaultData: Data = {
  content: [],
  root: { props: { title: '' } },
};

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = params.id as string;
  const isNew = pageId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [pageName, setPageName] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageDescription, setPageDescription] = useState('');
  const [pageData, setPageData] = useState<Data>(defaultData);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!isNew) {
      fetchPage();
    }
  }, [pageId]);

  const fetchPage = async () => {
    try {
      const response = await api.get(`/pages/${pageId}`);
      const page = response.data;
      setPageName(page.title);
      setPageSlug(page.slug);
      setPageDescription(page.description || '');
      setPageData(page.content || defaultData);
    } catch (error) {
      console.error('Error fetching page:', error);
      router.push('/pages');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: Data) => {
    setSaving(true);
    try {
      if (isNew) {
        const response = await api.post('/pages', {
          title: pageName || 'New Page',
          slug: pageSlug || 'new-page',
          description: pageDescription,
          content: data,
          isPublished: false,
        });
        router.push(`/pages/${response.data.id}/edit`);
      } else {
        await api.patch(`/pages/${pageId}`, {
          title: pageName,
          slug: pageSlug,
          description: pageDescription,
          content: data,
        });
      }
    } catch (error: any) {
      console.error('Error saving page:', error);
      const message = error.response?.data?.message || 'Error saving page';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const getDeviceWidth = () => {
    switch (device) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      default:
        return '100%';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/pages')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <Input
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder="Page name"
              className="w-48 h-8"
            />
            <span className="text-muted-foreground">/</span>
            <Input
              value={pageSlug}
              onChange={(e) => setPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="page-slug"
              className="w-36 h-8 font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Device Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <button
              onClick={() => setDevice('desktop')}
              className={`p-1.5 rounded ${device === 'desktop' ? 'bg-muted' : ''}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`p-1.5 rounded ${device === 'tablet' ? 'bg-muted' : ''}`}
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`p-1.5 rounded ${device === 'mobile' ? 'bg-muted' : ''}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'edit' ? 'bg-muted' : ''}`}
            >
              <Layers className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'preview' ? 'bg-muted' : ''}`}
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => handleSave(pageData)}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Puck
          config={puckConfig}
          data={pageData}
          onPublish={handleSave}
          onChange={(data) => setPageData(data)}
          overrides={{
            header: () => null, // Hide Puck's default header
          }}
        />
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed right-0 top-14 w-80 h-[calc(100vh-3.5rem)] bg-background border-l p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Settings da Page</h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meta Title</Label>
              <Input placeholder="Title para SEO" />
            </div>

            <div className="space-y-2">
              <Label>Meta Description</Label>
              <textarea
                className="w-full h-24 p-2 border rounded-md text-sm"
                placeholder="Description para SEO"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <select className="w-full p-2 border rounded-md">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <select className="w-full p-2 border rounded-md">
                <option value="public">Public</option>
                <option value="authenticated">Autenticados</option>
                <option value="admin">Apenas Admin</option>
              </select>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Appearance</h4>
              <div className="space-y-2">
                <Label>Cor de Fundo</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-12 h-8 p-1" defaultValue="#ffffff" />
                  <Input placeholder="#ffffff" className="flex-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
