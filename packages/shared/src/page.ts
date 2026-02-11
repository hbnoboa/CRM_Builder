export interface Page {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description?: string;
  icon?: string;
  content?: unknown;
  isPublished: boolean;
  publishedAt?: string;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
}
