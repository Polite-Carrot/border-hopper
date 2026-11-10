import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { track } from '../../core/analytics';
import { colors, fonts, spacing } from '../../theme';
import { Button } from './Button';

export interface ErrorBoundaryProps {
  /** Which screen this guards, for the report. */
  where: string;
  /** Leaves the broken screen: back to the menu. */
  onReset: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches an error while a screen draws. Without it React takes the whole
 * interface down and the player is left looking at the black background,
 * with no way out but closing the app. With it they get a message and a way
 * back to the menu, and the error goes to analytics so it can be fixed.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Border Hopper: screen failed', this.props.where, error, info.componentStack);
    // Firebase keeps parameter values to 100 characters.
    const component = /\bat (\w+)/.exec(info.componentStack ?? '')?.[1] ?? 'unknown';
    track('app_error', {
      where: this.props.where,
      message: String(error?.message ?? error).slice(0, 100),
      component: component.slice(0, 100),
    });
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>Sorry about that. Your progress is saved.</Text>
        <Text style={styles.detail} selectable>
          {String(error.message ?? error).slice(0, 300)}
        </Text>
        <Button label="Back to menu" variant="primary" icon="play" onPress={this.reset} style={styles.button} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  detail: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.sm, maxWidth: 360 },
  button: { marginTop: spacing.lg, alignSelf: 'stretch', maxWidth: 360 },
});
