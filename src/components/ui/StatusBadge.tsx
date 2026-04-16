import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { SignalStatus } from '@/src/types/signal';
import type { ViewStyle } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface BadgeConfig {
  label: string;
  icon: IoniconsName;
  colorKey: 'approaching' | 'bullish' | 'bearish' | 'textTertiary';
  dimKey: 'approachingDim' | 'bullishDim' | 'bearishDim' | 'card';
}

const STATUS_CONFIG: Record<SignalStatus, BadgeConfig> = {
  approaching: { label: 'APPROACHING', icon: 'radio-button-on', colorKey: 'approaching',  dimKey: 'approachingDim' },
  active:      { label: 'ACTIVE',      icon: 'flame',           colorKey: 'bullish',       dimKey: 'bullishDim'    },
  TP1_hit:     { label: 'TP1 HIT',     icon: 'checkmark-circle',colorKey: 'bullish',       dimKey: 'bullishDim'    },
  TP2_hit:     { label: 'TP2 HIT',     icon: 'checkmark-circle',colorKey: 'bullish',       dimKey: 'bullishDim'    },
  TP3_hit:     { label: 'TP3 HIT',     icon: 'trophy',          colorKey: 'bullish',       dimKey: 'bullishDim'    },
  stopped:     { label: 'STOPPED',     icon: 'close-circle',    colorKey: 'bearish',       dimKey: 'bearishDim'    },
  expired:     { label: 'EXPIRED',     icon: 'time',            colorKey: 'textTertiary',  dimKey: 'card'          },
  pending:     { label: 'PENDING',     icon: 'hourglass',       colorKey: 'textTertiary',  dimKey: 'card'          },
};

interface StatusBadgeProps {
  status: SignalStatus;
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const { theme } = useTheme();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  const color = theme[cfg.colorKey] as string;
  const bg    = theme[cfg.dimKey] as string;

  return (
    <View
      style={[styles.badge, { backgroundColor: bg, borderColor: color + '50' }, style]}
      accessibilityLabel={`Signal status: ${cfg.label}`}
    >
      <Ionicons name={cfg.icon} size={10} color={color} />
      <Text style={[styles.label, { color, fontFamily: 'Inter-SemiBold' }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
