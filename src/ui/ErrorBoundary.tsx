import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Banner } from './components/Banner';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches errors thrown during render (including invariant violations from
 * `assertMonthTotalsInvariants`) and surfaces them as a banner instead of
 * unmounting the whole app. Spec §7.2 layer 5: "Caller renders an error
 * banner instead of wrong numbers."
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log for debugging; real telemetry later.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="p-6 max-w-3xl">
          <Banner variant="error">
            <div className="font-mono text-sm">
              <div className="font-display text-base mb-2">Something went wrong</div>
              {this.state.error.message}
            </div>
          </Banner>
        </div>
      );
    }
    return this.props.children;
  }
}
