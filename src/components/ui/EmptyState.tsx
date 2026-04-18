import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  /** Ionicons name OR emoji string (legacy) */
  icon?: IoniconName | string;
  title: string;
  description?: string;
  style?: object;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  const { theme } = useTheme();

  const isIoniconName = typeof icon === 'string' && !icon.match(/\p{Emoji}/u);

  return (
    <View style={styles.container}>
      {icon && (
        isIoniconName
          ? <Ionicons name={icon as IoniconName} size={48} color={theme.textTertiary} style={styles.icon} />
          : <Text style={styles.emoji}>{icon}</Text>
      )}
      <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>{description}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  icon:        { marginBottom: 16 },
  emoji:       { fontSize: 50, marginBottom: 16 },
  title:       { fontSize: 20, textAlign: 'center', marginBottom: 10 },
  description: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
});
