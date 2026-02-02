'use client';

import { useState } from 'react';
import { ChevronDown, Check, Building2, Plus } from 'lucide-react';
import { useTenant } from '@/stores/tenant-context';
import { Button } from '@/components/ui/button';

export function WorkspaceSwitcher() {
  const { workspace, workspaces, setWorkspace, loading } = useTenant();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
          {workspace?.icon ? (
            <span className="text-lg">{workspace.icon}</span>
          ) : (
            <Building2 className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium text-sm truncate">
            {workspace?.name || 'Selecionar Workspace'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {workspace?.slug || 'No selecionado'}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-1 max-h-64 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setWorkspace(ws);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors ${
                  workspace?.id === ws.id ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                  {ws.icon ? (
                    <span className="text-lg">{ws.icon}</span>
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">{ws.slug}</p>
                </div>
                {workspace?.id === ws.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}

            {/* Create new workspace */}
            <div className="border-t mt-1 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  // TODO: Open create workspace modal
                }}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg border-2 border-dashed">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-sm">Create Workspace</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
