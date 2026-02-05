'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  File,
  Image,
  Code,
  Database,
  Settings,
  Users,
  Home,
  Star,
} from 'lucide-react';

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  href?: string;
  badge?: string;
  selected?: boolean;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  defaultExpanded?: string[];
  showIcons?: boolean;
  selectable?: boolean;
  variant?: 'default' | 'compact' | 'bordered';
}

const iconMap: Record<string, React.ReactNode> = {
  folder: <Folder className="h-4 w-4" />,
  folderOpen: <FolderOpen className="h-4 w-4" />,
  file: <File className="h-4 w-4" />,
  fileText: <FileText className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  home: <Home className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
};

function TreeNodeItem({
  node,
  level = 0,
  expanded,
  onToggle,
  showIcons,
  selectable,
  variant,
}: {
  node: TreeNode;
  level?: number;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  showIcons?: boolean;
  selectable?: boolean;
  variant?: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded[node.id];

  const getIcon = () => {
    if (node.icon && iconMap[node.icon]) {
      return iconMap[node.icon];
    }
    if (hasChildren) {
      return isExpanded ? iconMap.folderOpen : iconMap.folder;
    }
    return iconMap.file;
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
          node.selected && 'bg-primary/10 text-primary',
          variant === 'compact' && 'py-0.5'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
        </span>
        
        {showIcons && (
          <span className={cn(
            'text-muted-foreground',
            node.selected && 'text-primary'
          )}>
            {getIcon()}
          </span>
        )}
        
        <span className={cn('text-sm flex-1', node.selected && 'font-medium')}>
          {node.label}
        </span>
        
        {node.badge && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {node.badge}
          </span>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div className={cn(variant === 'bordered' && 'border-l ml-4 pl-2')}>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              showIcons={showIcons}
              selectable={selectable}
              variant={variant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({
  nodes,
  defaultExpanded = [],
  showIcons = true,
  selectable = false,
  variant = 'default',
}: TreeViewProps) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() =>
    defaultExpanded.reduce((acc, id) => ({ ...acc, [id]: true }), {})
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (safeNodes.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">🌳 Configure os nós da árvore</p>
      </div>
    );
  }

  return (
    <div className={cn('py-2', variant === 'bordered' && 'border rounded-lg p-2')}>
      {safeNodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          expanded={expanded}
          onToggle={toggleExpand}
          showIcons={showIcons}
          selectable={selectable}
          variant={variant}
        />
      ))}
    </div>
  );
}

export function TreeViewPreview() {
  return (
    <div className="border rounded-lg p-3 bg-background space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <ChevronDown className="h-3 w-3" />
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span>Pasta</span>
      </div>
      <div className="flex items-center gap-2 text-sm pl-4">
        <span className="w-3" />
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span>Arquivo</span>
      </div>
      <div className="flex items-center gap-2 text-sm pl-4">
        <span className="w-3" />
        <Image className="h-4 w-4 text-muted-foreground" />
        <span>Imagem</span>
      </div>
    </div>
  );
}
