import { Pressable, Text, View } from 'react-native';

import { colors } from '@/components/ui';
import { toISODate } from '@/lib/courts';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface Props {
  /** qualquer data do mês exibido */
  month: Date;
  onMonthChange: (d: Date) => void;
  /** horários abertos por dia (YYYY-MM-DD) */
  counts: Record<string, number>;
  selected: string;
  onSelect: (iso: string) => void;
}

/** Calendário mensal que mostra, por dia, se há horários disponíveis. */
export default function Calendar({ month, onMonthChange, counts, selected, onSelect }: Props) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const todayISO = toISODate(new Date());
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const canGoBack = new Date(year, m, 1) > new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Pressable disabled={!canGoBack} onPress={() => onMonthChange(new Date(year, m - 1, 1))} hitSlop={10}>
          <Text style={{ fontSize: 22, color: canGoBack ? colors.navy : colors.border, paddingHorizontal: 8 }}>‹</Text>
        </Pressable>
        <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
          {MONTHS[m]} {year}
        </Text>
        <Pressable onPress={() => onMonthChange(new Date(year, m + 1, 1))} hitSlop={10}>
          <Text style={{ fontSize: 22, color: colors.navy, paddingHorizontal: 8 }}>›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {DOW.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700' }}>
            {d}
          </Text>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (day === null) return <View key={col} style={{ flex: 1, height: 46 }} />;
            const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const past = iso < todayISO;
            const n = counts[iso] ?? 0;
            const isSel = iso === selected;
            const available = n > 0 && !past;
            return (
              <Pressable key={col} disabled={past} onPress={() => onSelect(iso)} style={{ flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    width: 38,
                    height: 40,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSel ? colors.navy : available ? colors.successSoft : 'transparent',
                    borderWidth: iso === todayISO && !isSel ? 1.5 : 0,
                    borderColor: colors.blue,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: isSel ? '#fff' : past ? '#CBD5E1' : colors.text }}>{day}</Text>
                  {available && (
                    <Text style={{ fontSize: 9, fontWeight: '800', color: isSel ? colors.sky : '#166534', marginTop: -1 }}>{n}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: colors.successSoft }} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Com horários livres</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: colors.navy }} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Selecionado</Text>
        </View>
      </View>
    </View>
  );
}
