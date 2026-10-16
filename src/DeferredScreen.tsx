import { Component, Suspense, type ReactNode } from 'react';

// Keep the shell and account controls usable if an optional screen cannot load.
export class DeferredScreen extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section role="alert" className="notice">
      <h2>{this.props.name} could not open</h2>
      <p>Check that the local server is running. Save any work on other screens before reloading. Review drafts kept in this tab will remain available.</p>
      <button type="button" onClick={() => window.location.reload()}>Reload workspace</button>
    </section>;
    return <Suspense fallback={<p role="status" aria-live="polite">Loading {this.props.name.toLowerCase()}…</p>}>{this.props.children}</Suspense>;
  }
}
