import { Component, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center text-2xl">⚠️</div>
          <h1 className="text-xl font-bold text-foreground">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error.message || 'Erro inesperado no aplicativo.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
