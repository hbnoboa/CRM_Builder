'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Copy,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertTriangle,
  Shield,
  Database,
  FileText,
  Globe,
  Layout,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useTenants, useCopyableData, useCopyTenantData } from '@/hooks/use-tenants';
import type {
  CopyableData,
  CopyEntitySelection,
  CopyResult,
} from '@/services/tenants.service';
import type { Tenant } from '@/types';

interface CopyTenantDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'select-tenants' | 'select-items' | 'result';

interface SelectedItems {
  roles: Set<string>;
  entities: Map<string, boolean>; // id → includeData
  pages: Set<string>;
  endpoints: Set<string>;
  pdfTemplates: Set<string>;
}

const emptySelection = (): SelectedItems => ({
  roles: new Set(),
  entities: new Map(),
  pages: new Set(),
  endpoints: new Set(),
  pdfTemplates: new Set(),
});

export function CopyTenantDataDialog({
  open,
  onOpenChange,
  onSuccess,
}: CopyTenantDataDialogProps) {
  const t = useTranslations('tenants');
  const tCommon = useTranslations('common');

  const [step, setStep] = useState<Step>('select-tenants');
  const [sourceTenantId, setSourceTenantId] = useState<string>('');
  const [targetTenantId, setTargetTenantId] = useState<string>('');
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'suffix'>('skip');
  const [selected, setSelected] = useState<SelectedItems>(emptySelection());
  const [result, setResult] = useState<CopyResult | null>(null);

  const { data: tenantsData } = useTenants({ limit: 100 });
  const tenants: Tenant[] = Array.isArray(tenantsData?.data) ? tenantsData.data : [];

  const { data: copyableData, isLoading: loadingCopyable } = useCopyableData(
    step === 'select-items' ? sourceTenantId : null,
  );

  const copyMutation = useCopyTenantData();

  const totalSelected = useMemo(
    () =>
      selected.roles.size +
      selected.entities.size +
      selected.pages.size +
      selected.endpoints.size +
      selected.pdfTemplates.size,
    [selected],
  );

  const resetDialog = useCallback(() => {
    setStep('select-tenants');
    setSourceTenantId('');
    setTargetTenantId('');
    setConflictStrategy('skip');
    setSelected(emptySelection());
    setResult(null);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) resetDialog();
      onOpenChange(open);
    },
    [onOpenChange, resetDialog],
  );

  const handleNext = useCallback(() => {
    if (step === 'select-tenants') {
      setSelected(emptySelection());
      setStep('select-items');
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step === 'select-items') setStep('select-tenants');
  }, [step]);

  const handleCopy = useCallback(async () => {
    const modules: {
      roles?: string[];
      entities?: CopyEntitySelection[];
      pages?: string[];
      endpoints?: string[];
      pdfTemplates?: string[];
    } = {};

    if (selected.roles.size > 0) modules.roles = [...selected.roles];
    if (selected.entities.size > 0) {
      modules.entities = [...selected.entities.entries()].map(([id, includeData]) => ({
        id,
        includeData,
      }));
    }
    if (selected.pages.size > 0) modules.pages = [...selected.pages];
    if (selected.endpoints.size > 0) modules.endpoints = [...selected.endpoints];
    if (selected.pdfTemplates.size > 0) modules.pdfTemplates = [...selected.pdfTemplates];

    try {
      const res = await copyMutation.mutateAsync({
        sourceTenantId,
        targetTenantId,
        conflictStrategy,
        modules,
      });
      setResult(res);
      setStep('result');
      onSuccess?.();
    } catch {
      // Error handled by mutation hook
    }
  }, [selected, sourceTenantId, targetTenantId, conflictStrategy, copyMutation, onSuccess]);

  // ═══════════════════════════════════════
  // Toggle helpers
  // ═══════════════════════════════════════

  const toggleRole = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev.roles);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, roles: next };
    });
  };

  const toggleAllRoles = (data: CopyableData) => {
    setSelected((prev) => {
      const allSelected = data.roles.every((r) => prev.roles.has(r.id));
      return {
        ...prev,
        roles: allSelected ? new Set() : new Set(data.roles.map((r) => r.id)),
      };
    });
  };

  const toggleEntity = (id: string) => {
    setSelected((prev) => {
      const next = new Map(prev.entities);
      if (next.has(id)) next.delete(id);
      else next.set(id, false);
      return { ...prev, entities: next };
    });
  };

  const toggleEntityData = (id: string) => {
    setSelected((prev) => {
      const next = new Map(prev.entities);
      if (next.has(id)) {
        next.set(id, !next.get(id));
      }
      return { ...prev, entities: next };
    });
  };

  const toggleAllEntities = (data: CopyableData) => {
    setSelected((prev) => {
      const allSelected = data.entities.every((e) => prev.entities.has(e.id));
      return {
        ...prev,
        entities: allSelected
          ? new Map()
          : new Map(data.entities.map((e) => [e.id, false])),
      };
    });
  };

  const togglePage = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev.pages);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, pages: next };
    });
  };

  const toggleAllPages = (data: CopyableData) => {
    setSelected((prev) => {
      const allSelected = data.pages.every((p) => prev.pages.has(p.id));
      return {
        ...prev,
        pages: allSelected ? new Set() : new Set(data.pages.map((p) => p.id)),
      };
    });
  };

  const toggleEndpoint = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev.endpoints);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, endpoints: next };
    });
  };

  const toggleAllEndpoints = (data: CopyableData) => {
    setSelected((prev) => {
      const allSelected = data.endpoints.every((e) => prev.endpoints.has(e.id));
      return {
        ...prev,
        endpoints: allSelected ? new Set() : new Set(data.endpoints.map((e) => e.id)),
      };
    });
  };

  const togglePdfTemplate = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev.pdfTemplates);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, pdfTemplates: next };
    });
  };

  const toggleAllPdfTemplates = (data: CopyableData) => {
    setSelected((prev) => {
      const allSelected = data.pdfTemplates.every((t) => prev.pdfTemplates.has(t.id));
      return {
        ...prev,
        pdfTemplates: allSelected
          ? new Set()
          : new Set(data.pdfTemplates.map((t) => t.id)),
      };
    });
  };

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t('copyData.title')}
          </DialogTitle>
          <DialogDescription>{t('copyData.description')}</DialogDescription>
        </DialogHeader>

        {/* ═══════ STEP 1: Select Tenants ═══════ */}
        {step === 'select-tenants' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('copyData.sourceTenant')}</label>
              <Select value={sourceTenantId} onValueChange={(v) => {
                setSourceTenantId(v);
                if (v === targetTenantId) setTargetTenantId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t('copyData.selectTenant')} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('copyData.targetTenant')}</label>
              <Select value={targetTenantId} onValueChange={setTargetTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('copyData.selectTenant')} />
                </SelectTrigger>
                <SelectContent>
                  {tenants
                    .filter((t) => t.id !== sourceTenantId)
                    .map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.slug})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('copyData.conflictStrategy')}</label>
              <Select value={conflictStrategy} onValueChange={(v) => setConflictStrategy(v as 'skip' | 'suffix')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">{t('copyData.skip')}</SelectItem>
                  <SelectItem value="suffix">{t('copyData.suffix')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {conflictStrategy === 'skip'
                  ? t('copyData.skipDescription')
                  : t('copyData.suffixDescription')}
              </p>
            </div>
          </div>
        )}

        {/* ═══════ STEP 2: Select Items ═══════ */}
        {step === 'select-items' && (
          <ScrollArea className="flex-1 min-h-0 max-h-[50vh] pr-3">
            {loadingCopyable ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : copyableData ? (
              <Accordion type="multiple" defaultValue={['roles', 'entities', 'pages', 'endpoints', 'pdfTemplates']} className="w-full">
                {/* Roles */}
                {copyableData.roles.length > 0 && (
                  <AccordionItem value="roles">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>{t('copyData.modules.roles')}</span>
                        <Badge variant="secondary">{copyableData.roles.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-2">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                          <Checkbox
                            checked={copyableData.roles.every((r) => selected.roles.has(r.id))}
                            onCheckedChange={() => toggleAllRoles(copyableData)}
                          />
                          {t('copyData.selectAll')}
                        </label>
                        {copyableData.roles.map((role) => (
                          <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer pl-4">
                            <Checkbox
                              checked={selected.roles.has(role.id)}
                              onCheckedChange={() => toggleRole(role.id)}
                            />
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: role.color || '#6366f1' }}
                            />
                            <span className="flex-1">{role.name}</span>
                            <span className="text-xs text-muted-foreground">{role.roleType}</span>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Entities */}
                {copyableData.entities.length > 0 && (
                  <AccordionItem value="entities">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span>{t('copyData.modules.entities')}</span>
                        <Badge variant="secondary">{copyableData.entities.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-2">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                          <Checkbox
                            checked={copyableData.entities.every((e) => selected.entities.has(e.id))}
                            onCheckedChange={() => toggleAllEntities(copyableData)}
                          />
                          {t('copyData.selectAll')}
                        </label>
                        {copyableData.entities.map((entity) => (
                          <div key={entity.id} className="pl-4 space-y-1">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={selected.entities.has(entity.id)}
                                onCheckedChange={() => toggleEntity(entity.id)}
                              />
                              <span>{entity.icon}</span>
                              <span className="flex-1">{entity.name}</span>
                              <span className="text-xs text-muted-foreground">{entity.slug}</span>
                            </label>
                            {selected.entities.has(entity.id) && entity._count.data > 0 && (
                              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pl-8">
                                <Checkbox
                                  checked={selected.entities.get(entity.id) || false}
                                  onCheckedChange={() => toggleEntityData(entity.id)}
                                />
                                {t('copyData.includeData')}
                                <Badge variant="outline" className="text-xs">
                                  {entity._count.data} {t('copyData.records')}
                                </Badge>
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Pages */}
                {copyableData.pages.length > 0 && (
                  <AccordionItem value="pages">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Layout className="h-4 w-4" />
                        <span>{t('copyData.modules.pages')}</span>
                        <Badge variant="secondary">{copyableData.pages.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-2">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                          <Checkbox
                            checked={copyableData.pages.every((p) => selected.pages.has(p.id))}
                            onCheckedChange={() => toggleAllPages(copyableData)}
                          />
                          {t('copyData.selectAll')}
                        </label>
                        {copyableData.pages.map((page) => (
                          <label key={page.id} className="flex items-center gap-2 text-sm cursor-pointer pl-4">
                            <Checkbox
                              checked={selected.pages.has(page.id)}
                              onCheckedChange={() => togglePage(page.id)}
                            />
                            <span className="flex-1">{page.title}</span>
                            <span className="text-xs text-muted-foreground">{page.slug}</span>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Endpoints */}
                {copyableData.endpoints.length > 0 && (
                  <AccordionItem value="endpoints">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>{t('copyData.modules.endpoints')}</span>
                        <Badge variant="secondary">{copyableData.endpoints.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-2">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                          <Checkbox
                            checked={copyableData.endpoints.every((e) => selected.endpoints.has(e.id))}
                            onCheckedChange={() => toggleAllEndpoints(copyableData)}
                          />
                          {t('copyData.selectAll')}
                        </label>
                        {copyableData.endpoints.map((ep) => (
                          <label key={ep.id} className="flex items-center gap-2 text-sm cursor-pointer pl-4">
                            <Checkbox
                              checked={selected.endpoints.has(ep.id)}
                              onCheckedChange={() => toggleEndpoint(ep.id)}
                            />
                            <Badge variant="outline" className="text-xs font-mono">
                              {ep.method}
                            </Badge>
                            <span className="flex-1 font-mono text-xs">{ep.path}</span>
                            <span className="text-xs text-muted-foreground">{ep.name}</span>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* PDF Templates */}
                {copyableData.pdfTemplates.length > 0 && (
                  <AccordionItem value="pdfTemplates">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{t('copyData.modules.pdfTemplates')}</span>
                        <Badge variant="secondary">{copyableData.pdfTemplates.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-2">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                          <Checkbox
                            checked={copyableData.pdfTemplates.every((t) => selected.pdfTemplates.has(t.id))}
                            onCheckedChange={() => toggleAllPdfTemplates(copyableData)}
                          />
                          {t('copyData.selectAll')}
                        </label>
                        {copyableData.pdfTemplates.map((tmpl) => (
                          <label key={tmpl.id} className="flex items-center gap-2 text-sm cursor-pointer pl-4">
                            <Checkbox
                              checked={selected.pdfTemplates.has(tmpl.id)}
                              onCheckedChange={() => togglePdfTemplate(tmpl.id)}
                            />
                            <span className="flex-1">{tmpl.name}</span>
                            <span className="text-xs text-muted-foreground">{tmpl.slug}</span>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            ) : null}
          </ScrollArea>
        )}

        {/* ═══════ STEP 3: Result ═══════ */}
        {step === 'result' && result && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <span className="font-semibold">{t('copyData.result.title')}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {result.copied.roles > 0 && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{result.copied.roles}</div>
                  <div className="text-xs text-muted-foreground">{t('copyData.modules.roles')}</div>
                </div>
              )}
              {result.copied.entities > 0 && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{result.copied.entities}</div>
                  <div className="text-xs text-muted-foreground">{t('copyData.modules.entities')}</div>
                </div>
              )}
              {result.copied.entityData > 0 && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{result.copied.entityData}</div>
                  <div className="text-xs text-muted-foreground">{t('copyData.records')}</div>
                </div>
              )}
              {result.copied.pages > 0 && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{result.copied.pages}</div>
                  <div className="text-xs text-muted-foreground">{t('copyData.modules.pages')}</div>
                </div>
              )}
              {result.copied.endpoints > 0 && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{result.copied.endpoints}</div>
                  <div className="text-xs text-muted-foreground">{t('copyData.modules.endpoints')}</div>
                </div>
              )}
              {result.copied.pdfTemplates > 0 && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{result.copied.pdfTemplates}</div>
                  <div className="text-xs text-muted-foreground">{t('copyData.modules.pdfTemplates')}</div>
                </div>
              )}
            </div>

            {result.skipped.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('copyData.result.skipped')} ({result.skipped.length})</p>
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                  {result.skipped.map((item, i) => (
                    <div key={i}>- {item}</div>
                  ))}
                </div>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('copyData.result.warnings')} ({result.warnings.length})
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                  {result.warnings.map((item, i) => (
                    <div key={i}>- {item}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ Footer ═══════ */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {step === 'select-tenants' && (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={handleNext}
                disabled={!sourceTenantId || !targetTenantId}
              >
                {t('copyData.next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === 'select-items' && (
            <>
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('copyData.back')}
              </Button>
              <div className="flex items-center gap-3">
                {totalSelected > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {totalSelected} {t('copyData.itemsSelected')}
                  </span>
                )}
                <Button
                  onClick={handleCopy}
                  disabled={totalSelected === 0 || copyMutation.isPending}
                >
                  {copyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      {t('copyData.copying')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      {t('copyData.copy')}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'result' && (
            <>
              <div />
              <Button onClick={() => handleOpenChange(false)}>
                {tCommon('close')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
