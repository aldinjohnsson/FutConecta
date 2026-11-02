import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

export const colors = {
  primary: '#0F2A5F', // azul-marinho (botões, destaques)
  primaryDark: '#0A1D44',
  primarySoft: '#E6EDFA',
  accent: '#F5B301',
  navy: '#0B1B3F',
  navy2: '#13306B',
  blue: '#2563EB',
  sky: '#38BDF8',
  gold: '#F5C451',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  bg: '#F3F6FB',
  card: '#FFFFFF',
  text: '#0B1B3F',
  muted: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warnSoft: '#FEF3C7',
};

/** Tela rolável com largura máxima (fica boa no celular e no navegador). */
export function Screen({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.screenContent, padded && { padding: 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.screenInner}>{children}</View>
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function TextField({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor="#9AA8A0"
        {...props}
        style={[styles.input, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const isDisabled = disabled || loading;
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.card;
  const fg = variant === 'secondary' ? colors.primary : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 1.5, borderColor: colors.primary },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Banner({ kind = 'error', children }: { kind?: 'error' | 'warn' | 'info'; children: ReactNode }) {
  const bg = kind === 'error' ? colors.dangerSoft : kind === 'warn' ? colors.warnSoft : colors.primarySoft;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: colors.text, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Spinner() {
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1, alignItems: 'center' },
  screenInner: { width: '100%', maxWidth: 720 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  muted: { fontSize: 14, color: colors.muted },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B1B3F',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
    minHeight: 50,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  banner: { borderRadius: 10, padding: 12, marginBottom: 12 },
});


/** Cabeçalho de seção: título + ação opcional ("Ver todas"). */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.blue, fontWeight: '700', fontSize: 14 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Selo colorido (disponibilidade, status). */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'success' | 'neutral' | 'warn' | 'info' }) {
  const map = {
    success: { bg: colors.successSoft, fg: '#166534' },
    neutral: { bg: '#E2E8F0', fg: colors.muted },
    warn: { bg: colors.warnSoft, fg: '#92400E' },
    info: { bg: colors.primarySoft, fg: colors.primary },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' }}>
      <Text style={{ color: map.fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
