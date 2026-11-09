import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { Badge, colors } from '@/components/ui';
import { availabilityLabel, CourtCardData } from '@/lib/courts';
import { formatBRL } from '@/lib/format';
import { WEEKDAY_SHORT } from '@/lib/types';

/** Linha compacta de quadra (foto, nome, local, disponibilidade) para a lista "Quadras próximas". */
export default function CourtRow({ data }: { data: CourtCardData }) {
  const router = useRouter();
  const av = availabilityLabel(data.openByDate, WEEKDAY_SHORT);

  return (
    <Pressable
      onPress={() => router.push(`/explorar/${data.courtId}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ width: 84, height: 84, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.navy2 }}>
        {data.coverUrl ? (
          <Image source={{ uri: data.coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 30 }}>⚽</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={1}>
          {data.institutionName}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {data.courtName} · {data.sport}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          📍 {data.city}
        </Text>
        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Badge label={av.text} tone={av.tone === 'success' ? 'success' : av.tone === 'info' ? 'info' : 'neutral'} />
          {data.minPriceCents !== null && (
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>desde {formatBRL(data.minPriceCents)}</Text>
          )}
        </View>
      </View>
      <Text style={{ color: colors.muted, fontSize: 24 }}>›</Text>
    </Pressable>
  );
}
