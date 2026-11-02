import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { Badge, colors } from '@/components/ui';
import { availabilityLabel, CourtCardData } from '@/lib/courts';
import { formatBRL } from '@/lib/format';
import { WEEKDAY_SHORT } from '@/lib/types';

/** Card de quadra: capa, nome, cidade e disponibilidade (hoje / amanhã / próximo dia). */
export default function CourtCard({ data, width }: { data: CourtCardData; width?: number }) {
  const router = useRouter();
  const av = availabilityLabel(data.openByDate, WEEKDAY_SHORT);

  return (
    <Pressable
      onPress={() => router.push(`/explorar/${data.courtId}`)}
      style={{ width: width ?? '100%', marginBottom: 14 }}
    >
      <View style={{ backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <View style={{ height: 130, backgroundColor: colors.navy2 }}>
          {data.coverUrl ? (
            <Image source={{ uri: data.coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 44 }}>⚽</Text>
            </View>
          )}
          <View style={{ position: 'absolute', left: 10, top: 10 }}>
            <Badge label={av.text} tone={av.tone === 'success' ? 'success' : av.tone === 'info' ? 'info' : 'neutral'} />
          </View>
        </View>
        <View style={{ padding: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }} numberOfLines={1}>
            {data.institutionName}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 2 }} numberOfLines={1}>
            {data.courtName} · {data.sport} · {data.city}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>até {data.capacity} jogadores</Text>
            {data.minPriceCents !== null && (
              <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 13 }}>a partir de {formatBRL(data.minPriceCents)}</Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
