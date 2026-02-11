'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div className="p-4 text-red-500">{this.props.fallbackMessage || 'An unexpected error occurred.'}</div>;
    }
    return this.props.children;
  }
}

// Wrapper component with translations
export function TranslatedErrorBoundary({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const t = useTranslations('common');
  return (
    <ErrorBoundary fallback={fallback} fallbackMessage={t('unexpectedError')}>
      {children}
    </ErrorBoundary>
  );
}
