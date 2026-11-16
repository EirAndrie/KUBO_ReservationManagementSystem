import React from 'react';
import { ErrorState } from '@/components/common';

/**
 * Catches a route page that fails to render, most often a lazy chunk that no
 * longer exists after a redeploy, and shows a retry message inside the shell
 * instead of unmounting the whole app. AppShell keys it by path, so navigating
 * elsewhere clears the error.
 */
export class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <ErrorState error={this.state.error} onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
