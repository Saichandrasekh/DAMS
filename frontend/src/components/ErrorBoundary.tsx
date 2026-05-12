import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    console.error('[DAMS ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  handleClear = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/login';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: 'var(--background, #f8fafc)',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            width: '100%',
            background: 'white',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 10px 25px rgba(0,0,0,.08)',
            borderTop: '4px solid #ef4444',
          }}
        >
          <h2 style={{ margin: '0 0 8px 0', color: '#991b1b' }}>
            <i className="fas fa-circle-exclamation" style={{ marginRight: 8 }} />
            Something went wrong
          </h2>
          <p style={{ marginTop: 0, color: '#64748b' }}>
            The page crashed before it could render. Details below — share them with the dev team.
          </p>

          <pre
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: 12,
              maxHeight: 180,
              overflow: 'auto',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#991b1b',
            }}
          >
            {this.state.error.name}: {this.state.error.message}
            {this.state.error.stack ? '\n\n' + this.state.error.stack.split('\n').slice(0, 6).join('\n') : ''}
          </pre>

          {this.state.info?.componentStack && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 13 }}>
                Component stack
              </summary>
              <pre
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  color: '#334155',
                }}
              >
                {this.state.info.componentStack}
              </pre>
            </details>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#4f46e5',
                color: 'white',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-rotate-right" style={{ marginRight: 6 }} />
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleClear}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-broom" style={{ marginRight: 6 }} />
              Clear session and re-login
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Dismiss (advanced)
            </button>
          </div>
        </div>
      </div>
    );
  }
}
