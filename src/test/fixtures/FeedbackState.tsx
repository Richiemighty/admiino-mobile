import { ActivityIndicator, Text, View } from 'react-native';

export type FeedbackStateProps = { state: 'loading' } | { state: 'error'; message: string };

export function FeedbackState(props: FeedbackStateProps) {
  if (props.state === 'loading') {
    return <ActivityIndicator accessibilityLabel="Loading tasks" />;
  }

  return (
    <View>
      <Text accessibilityRole="alert">{props.message}</Text>
    </View>
  );
}
