'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted px-4">
          <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-6 sm:p-8 text-center space-y-4">
            <div className="flex justify-center">
              <svg className="w-12 h-12 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-foreground">
              Etwas ist schiefgelaufen
            </h1>
            {this.state.error?.message && (
              <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3 break-words font-mono">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                Seite neu laden
              </button>
              <button
                onClick={exportData}
                className="w-full rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Daten exportieren
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/20 transition-colors"
              >
                Daten löschen &amp; neu starten
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const exportData = () => {
  try {
    const data = localStorage.getItem('cycletrack_data');
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cycletrack-notfall-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed', e);
  }
};

export default ErrorBoundary;
