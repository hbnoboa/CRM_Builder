'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash,
  Eye,
  FileText,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/lib/api';

interface Page {
  id: string;
  workspaceId: string;
  title: string;
  slug: string;
  description?: string;
  content: object;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function PagesPage() {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const response = await api.get('/pages');
      // A API pode retornar { data: [...], meta: {...} } ou um array direto
      const pagesDate = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setPages(pagesDate);
    } catch (error) {
      console.error('Error loading pages:', error);
      // Fallback for demo if API fails
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pageToDelete) return;
    
    setDeleting(pageToDelete.id);
    try {
      await api.delete(`/pages/${pageToDelete.id}`);
      setPages(pages.filter(p => p.id !== pageToDelete.id));
    } catch (error) {
      console.error('Error deleting page:', error);
    } finally {
      setDeleting(null);
      setPageToDelete(null);
    }
  };

  const handlePublish = async (page: Page) => {
    try {
      await api.patch(`/pages/${page.id}`, { isPublished: !page.isPublished });
      setPages(pages.map(p => 
        p.id === page.id ? { ...p, isPublished: !p.isPublished } : p
      ));
    } catch (error) {
      console.error('Error publishing page:', error);
    }
  };

  const handleDuplicate = async (page: Page) => {
    try {
      const response = await api.post('/pages', {
        title: `${page.title} (Copy)`,
        slug: `${page.slug}-copy-${Date.now()}`,
        description: page.description,
        content: page.content,
        isPublished: false,
      });
      setPages([response.data, ...pages]);
    } catch (error) {
      console.error('Error duplicating page:', error);
    }
  };

  const filteredPages = pages.filter((page) =>
    page.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm mb-2" aria-label="Breadcrumb">
        <ol className="list-none p-0 inline-flex">
          <li className="flex items-center">
            <Link href="/dashboard" className="text-muted-foreground hover:text-primary" data-testid="breadcrumb-dashboard">
              Dashboard
            </Link>
            <span className="mx-2">/</span>
          </li>
          <li className="flex items-center" aria-current="page">
            <span className="text-primary font-medium" data-testid="breadcrumb-pages">Pages</span>
          </li>
        </ol>
      </nav>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="pages-heading">Pages</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your CRM pages
          </p>
        </div>
        <Link href="/pages/new">
          <Button data-testid="new-page-button">
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="search-pages-input"
        />
      </div>

      {/* Pages Grid */}
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
      ) : filteredPages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No page found</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? 'No page matches your search.'
                : 'Start by creating your first custom page.'}
            </p>
            {!search && (
              <Link href="/pages/new">
                <Button data-testid="create-first-page-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Page
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map((page) => (
            <Card
              key={page.id}
              className="group hover:border-primary/50 transition-colors"
              data-testid={`page-card-${page.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid={`page-title-${page.id}`}>{page.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        /{page.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        page.isPublished
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                      data-testid={`page-status-${page.id}`}
                    >
                      {page.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`page-menu-btn-${page.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/pages/${page.id}/edit`)} data-testid={`edit-page-menu-${page.id}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/preview/${page.slug}`, '_blank')} data-testid={`preview-page-menu-${page.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(page)} data-testid={`duplicate-page-menu-${page.id}`}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePublish(page)} data-testid={`publish-page-menu-${page.id}`}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {page.isPublished ? 'Unpublish' : 'Publish'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setPageToDelete(page)}
                          className="text-destructive"
                          data-testid={`delete-page-menu-${page.id}`}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {page.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                    {page.description}
                  </p>
                )}

                <div className="text-xs text-muted-foreground mt-4">
                  Updated on {new Date(page.updatedAt).toLocaleDateString('en-US')}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Link href={`/pages/${page.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" data-testid={`edit-page-btn-${page.id}`}>
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/preview/${page.slug}`, '_blank')}
                    data-testid={`preview-page-btn-${page.id}`}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDuplicate(page)}
                    data-testid={`duplicate-page-btn-${page.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!pageToDelete} onOpenChange={() => setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the page "{pageToDelete?.title}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
