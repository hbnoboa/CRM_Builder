'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EntitySettings } from '@crm-builder/shared';

interface BooleanFieldOption {
  slug: string;
  label: string;
}

interface EntityInfoPanelProps {
  name: string;
  slug: string;
  description: string;
  settings: EntitySettings;
  booleanFields?: BooleanFieldOption[];
  onChangeName: (name: string) => void;
  onChangeDescription: (description: string) => void;
  onChangeSettings: (settings: EntitySettings) => void;
}

export function EntityInfoPanel({
  name,
  slug,
  description,
  settings,
  booleanFields = [],
  onChangeName,
  onChangeDescription,
  onChangeSettings,
}: EntityInfoPanelProps) {
  const toggleSetting = (key: keyof EntitySettings) => {
    onChangeSettings({ ...settings, [key]: !settings[key] });
  };

  return (
    <div className="space-y-4">
      {/* Nome */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Nome da entidade</Label>
        <Input
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          className="h-8 text-sm"
          placeholder="Nome da entidade"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Slug</Label>
        <p className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
          {slug}
        </p>
      </div>

      {/* Descricao */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Descricao</Label>
        <Textarea
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          className="text-sm min-h-[60px] resize-none"
          placeholder="Descricao da entidade"
          rows={3}
        />
      </div>

      {/* Separator */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-3">Configuracoes</p>

        <div className="space-y-3">
          <SettingSwitch
            label="Permitir criar registros"
            checked={settings.allowCreate !== false}
            onCheckedChange={() => toggleSetting('allowCreate')}
          />
          <SettingSwitch
            label="Permitir editar registros"
            checked={settings.allowEdit !== false}
            onCheckedChange={() => toggleSetting('allowEdit')}
          />
          <SettingSwitch
            label="Permitir excluir registros"
            checked={settings.allowDelete !== false}
            onCheckedChange={() => toggleSetting('allowDelete')}
          />
          <SettingSwitch
            label="Auditoria habilitada"
            checked={settings.enableAudit === true}
            onCheckedChange={() => toggleSetting('enableAudit')}
          />
          <SettingSwitch
            label="Exclusao logica (soft delete)"
            checked={settings.softDelete === true}
            onCheckedChange={() => toggleSetting('softDelete')}
          />
          <SettingSwitch
            label="Capturar localizacao GPS"
            checked={settings.captureLocation === true}
            onCheckedChange={() => toggleSetting('captureLocation')}
          />
        </div>
      </div>

      {/* Lock Field */}
      {booleanFields.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Travamento de registro</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Campo que trava edicao</Label>
            <Select
              value={settings.lockField || '_none'}
              onValueChange={(value) =>
                onChangeSettings({ ...settings, lockField: value === '_none' ? undefined : value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {booleanFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Quando este campo for marcado como verdadeiro, o registro nao podera mais ser editado por usuarios sem permissao.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
