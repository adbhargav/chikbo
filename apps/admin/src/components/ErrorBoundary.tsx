import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Changing this (e.g. the current path) clears a caught error. */
  resetKey?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps one broken screen from blanking the whole console: the sidebar stays
 * usable and the staff member can reload or move to another page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin screen crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page">
        <div className="card pad" role="alert" style={{ maxWidth: 560 }}>
          <h3 className="card-title">This screen hit a problem</h3>
          <p className="muted" style={{ margin: '6px 0 16px' }}>
            Nothing was lost. Reload the page, or pick another section from the menu.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
