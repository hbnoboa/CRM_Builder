'use client';

import { useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { normalizeHref } from '@/lib/normalize-href';
import {
  FileText,
  Users,
  Building2,
  Shield,
  Truck,
  AlertTriangle,
  Car,
  Wrench,
  Settings,
  LayoutDashboard,
  ChevronRight,
  LucideIcon
} from 'lucide-react';

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  'file-text': FileText,
  'users': Users,
  'building': Building2,
  'shield': Shield,
  'truck': Truck,
  'alert': AlertTriangle,
  'car': Car,
  'wrench': Wrench,
  'settings': Settings,
  'dashboard': LayoutDashboard,
};

export interface DashboardCard {
  title: string;
  description?: string;
  icon?: string;
  href: string;
  color?: string;
  count?: number;
}

export interface DashboardCardsProps {
  title?: string;
  subtitle?: string;
  cards: DashboardCard[];
  columns?: 2 | 3 | 4;
  variant?: 'default' | 'compact' | 'detailed';
}

export function DashboardCards({
  title,
  subtitle,
  cards,
  columns = 3,
  variant = 'default'
}: DashboardCardsProps) {
  const router = useRouter();
  const locale = useLocale();

  const handleCardClick = (href: string) => {
    if (href.startsWith('http')) {
      window.open(href, '_blank');
    } else {
      // Normaliza e usa router.push que auto-adiciona locale
      const normalizedHref = normalizeHref(href);
      router.push(normalizedHref);
    }
  };

  const getIcon = (iconName?: string) => {
    if (!iconName) return LayoutDashboard;
    return iconMap[iconName] || LayoutDashboard;
  };

  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  const safeCards = Array.isArray(cards) ? cards : [];

  if (variant === 'compact') {
    return (
      <div className="space-y-4">
        {title && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
          </div>
        )}
        <div className={`grid ${gridCols[columns]} gap-3`}>
          {safeCards.map((card, index) => {
            const IconComponent = getIcon(card.icon);
            return (
              <button
                key={index}
                onClick={() => handleCardClick(card.href)}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-left group"
              >
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: card.color ? `${card.color}15` : '#3b82f615' }}
                >
                  <IconComponent
                    className="h-5 w-5"
                    style={{ color: card.color || '#3b82f6' }}
                  />
                </div>
                <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </span>
                {card.count !== undefined && (
                  <span className="ml-auto text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {card.count}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className="space-y-6">
        {title && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-2 text-lg">{subtitle}</p>}
          </div>
        )}
        <div className={`grid ${gridCols[columns]} gap-6`}>
          {safeCards.map((card, index) => {
            const IconComponent = getIcon(card.icon);
            return (
              <button
                key={index}
                onClick={() => handleCardClick(card.href)}
                className="flex flex-col p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg hover:border-transparent transition-all text-left group relative overflow-hidden"
              >
                {/* Gradient accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: card.color || '#3b82f6' }}
                />

                <div className="flex items-start justify-between mb-4">
                  <div
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: card.color ? `${card.color}15` : '#3b82f615' }}
                  >
                    <IconComponent
                      className="h-6 w-6"
                      style={{ color: card.color || '#3b82f6' }}
                    />
                  </div>
                  {card.count !== undefined && (
                    <span className="text-2xl font-bold text-gray-900">
                      {card.count}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h3>

                {card.description && (
                  <p className="text-sm text-gray-500 mb-4 flex-1">
                    {card.description}
                  </p>
                )}

                <div className="flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
                  Acessar
                  <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className="space-y-6">
      {title && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className={`grid ${gridCols[columns]} gap-4`}>
        {safeCards.map((card, index) => {
          const IconComponent = getIcon(card.icon);
          return (
            <button
              key={index}
              onClick={() => handleCardClick(card.href)}
              className="flex flex-col items-center p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all text-center group"
            >
              <div
                className="p-4 rounded-full mb-4"
                style={{ backgroundColor: card.color ? `${card.color}15` : '#3b82f615' }}
              >
                <IconComponent
                  className="h-8 w-8"
                  style={{ color: card.color || '#3b82f6' }}
                />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                {card.title}
              </h3>

              {card.description && (
                <p className="text-sm text-gray-500">
                  {card.description}
                </p>
              )}

              {card.count !== undefined && (
                <span className="mt-3 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {card.count} registros
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Preview component for Puck editor
export function DashboardCardsPreview({
  title,
  subtitle,
  cards,
  columns = 3,
  variant = 'default'
}: DashboardCardsProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  const safeCards = Array.isArray(cards) ? cards : [];

  return (
    <div className="space-y-4 p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/30">
      <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
        <LayoutDashboard className="h-4 w-4" />
        Dashboard Cards - {variant}
      </div>

      {title && (
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
        </div>
      )}

      <div className={`grid ${gridCols[columns]} gap-3`}>
        {safeCards.length > 0 ? (
          safeCards.map((card, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
            >
              <div className="p-2 rounded-lg bg-blue-50">
                <LayoutDashboard className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{card.title}</p>
                <p className="text-xs text-gray-500 truncate">{card.href}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-gray-500">
            Adicione cards para o dashboard
          </div>
        )}
      </div>
    </div>
  );
}
