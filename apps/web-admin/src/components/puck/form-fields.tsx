'use client';

import React, { useState } from 'react';
import { Calendar, Upload, MapPin, ChevronDown, X, Plus } from 'lucide-react';

// ============================================================================
// TEXT INPUT
// ============================================================================

export interface TextInputProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function TextInput({ label, placeholder, required, helpText }: TextInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        placeholder={placeholder || `Digite ${label.toLowerCase()}...`}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// TEXTAREA
// ============================================================================

export interface TextAreaProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function TextAreaField({ label, placeholder, required, rows = 3, helpText }: TextAreaProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        placeholder={placeholder || `Digite ${label.toLowerCase()}...`}
        rows={rows}
        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// NUMBER INPUT
// ============================================================================

export interface NumberInputProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function NumberInput({ label, placeholder, required, min, max, step = 1, helpText }: NumberInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="number"
        placeholder={placeholder || '0'}
        min={min}
        max={max}
        step={step}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// SELECT / DROPDOWN
// ============================================================================

export interface SelectFieldProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  options: { label: string; value: string }[];
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function SelectField({ label, placeholder, required, options, helpText }: SelectFieldProps) {
  const safeOptions = Array.isArray(options) ? options : [];

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <select className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">{placeholder || 'Selecione...'}</option>
          {safeOptions.map((opt, i) => (
            <option key={i} value={opt.value || opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// CHECKBOX
// ============================================================================

export interface CheckboxFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  fieldName?: string;
  puck?: any;
}

export function CheckboxField({ label, description, required }: CheckboxFieldProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-input"
      />
      <div>
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// DATE PICKER
// ============================================================================

export interface DatePickerProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  includeTime?: boolean;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function DatePickerField({ label, placeholder, required, includeTime, helpText }: DatePickerProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type={includeTime ? 'datetime-local' : 'date'}
          className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

export interface FileUploadProps {
  label: string;
  required?: boolean;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function FileUploadField({ label, required, accept, multiple, maxSize, helpText }: FileUploadProps) {
  const [files, setFiles] = useState<string[]>([]);

  const acceptText = accept === 'image/*' ? 'imagens' : accept === '.pdf' ? 'PDFs' : 'arquivos';

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="border-2 border-dashed border-input rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Arraste {acceptText} aqui ou <span className="text-primary">clique para selecionar</span>
        </p>
        {maxSize && (
          <p className="text-xs text-muted-foreground mt-1">
            Tamanho maximo: {maxSize}MB
          </p>
        )}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
        />
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// IMAGE UPLOAD
// ============================================================================

export interface ImageUploadProps {
  label: string;
  required?: boolean;
  multiple?: boolean;
  maxSize?: number;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function ImageUploadField({ label, required, multiple, maxSize = 5, helpText }: ImageUploadProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="border-2 border-dashed border-input rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/30">
        <div className="w-16 h-16 mx-auto mb-3 rounded-lg bg-muted flex items-center justify-center">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Clique para enviar imagem</p>
        <p className="text-xs text-muted-foreground mt-1">
          PNG, JPG ou WEBP (max. {maxSize}MB)
        </p>
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
        />
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// MAP / LOCATION PICKER
// ============================================================================

export interface MapPickerProps {
  label: string;
  required?: boolean;
  defaultLat?: number;
  defaultLng?: number;
  zoom?: number;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function MapPickerField({ label, required, defaultLat = -23.5505, defaultLng = -46.6333, zoom = 12, helpText }: MapPickerProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Latitude"
              defaultValue={defaultLat}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Longitude"
              defaultValue={defaultLng}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
        </div>
        <div className="h-48 rounded-lg bg-muted border border-input overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-100 to-green-100 dark:from-blue-900/30 dark:to-green-900/30">
            <div className="text-center">
              <MapPin className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Mapa interativo</p>
              <p className="text-xs text-muted-foreground">Clique para selecionar local</p>
            </div>
          </div>
        </div>
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// EMAIL INPUT
// ============================================================================

export interface EmailInputProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function EmailInput({ label, placeholder, required, helpText }: EmailInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="email"
        placeholder={placeholder || 'email@exemplo.com'}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// PHONE INPUT
// ============================================================================

export interface PhoneInputProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function PhoneInput({ label, placeholder, required, helpText }: PhoneInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="tel"
        placeholder={placeholder || '(00) 00000-0000'}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// CURRENCY INPUT
// ============================================================================

export interface CurrencyInputProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  currency?: string;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function CurrencyInput({ label, placeholder, required, currency = 'R$', helpText }: CurrencyInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {currency}
        </span>
        <input
          type="text"
          placeholder={placeholder || '0,00'}
          className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// TAGS / MULTI-VALUE INPUT
// ============================================================================

export interface TagsInputProps {
  label: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function TagsInput({ label, placeholder, required, helpText }: TagsInputProps) {
  const [tags, setTags] = useState<string[]>(['Exemplo 1', 'Exemplo 2']);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="min-h-10 p-2 rounded-md border border-input bg-background">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {tag}
              <X className="h-3 w-3 cursor-pointer hover:text-destructive" />
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder={placeholder || 'Digite e pressione Enter...'}
          className="w-full text-sm bg-transparent outline-none"
        />
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// RATING
// ============================================================================

export interface RatingFieldProps {
  label: string;
  required?: boolean;
  maxStars?: number;
  helpText?: string;
  fieldName?: string;
  puck?: any;
}

export function RatingField({ label, required, maxStars = 5, helpText }: RatingFieldProps) {
  const [rating, setRating] = useState(3);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex gap-1">
        {Array.from({ length: maxStars }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i + 1)}
            className={`text-2xl ${i < rating ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">({rating}/{maxStars})</span>
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

// ============================================================================
// SWITCH / TOGGLE
// ============================================================================

export interface SwitchFieldProps {
  label: string;
  description?: string;
  defaultChecked?: boolean;
  fieldName?: string;
  puck?: any;
}

export function SwitchField({ label, description, defaultChecked }: SwitchFieldProps) {
  const [checked, setChecked] = useState(defaultChecked || false);

  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-sm font-medium">{label}</label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => setChecked(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  );
}
