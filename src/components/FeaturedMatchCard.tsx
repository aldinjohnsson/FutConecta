import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { Button, colors } from '@/components/ui';
import { formatBRL, formatSlotWhen, playerPaysCents } from '@/lib/format';
import { FeaturedMatch } from '@/lib/featured';
import { WEEKDAY_SHORT } from '@/lib/types';

/** Cartão "Partida em destaque": foto da quadra, vagas, data, local, preço e botão de entrar. */
export default function FeaturedMatchCard({ data, commissionBps }: { data: FeaturedMatch; commissionBps: number }) {
  const router = useRouter();
  const full = data.taken >= data.total;
  const price = playerPaysCents(data.linePriceCents, data.commissionMode, commissionBps);
  const when = formatSlotWhen(data.slotDate, data.startTime, WEEKDAY_SHORT).replace(' · ', ' • ');
  const open = () => router.push(`/partidas/${data.id}`);

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#08160F',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <Pressable onPress={open} style={{ flexDirection: 'row' }}>
        <View style={{ width: '44%', height: 128, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.navy2 }}>
          {data.coverUrl ? (
            <Image source={{ uri: data.coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 40 }}>⚽</Text>
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              left: 8,
              top: 8,
              backgroundColor: full ? '#475569' : colors.primary,
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
              {full ? 'Lotada' : `Vagas: ${data.total - data.taken} de ${data.total}`}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, paddingLeft: 12, justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} numberOfLines={2}>
              ⚽ {data.title || `Futebol ${data.sport}`}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13 }} numberOfLines={1}>
              📅 {when}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 2, fontSize: 13 }} numberOfLines={1}>
              📍 {data.institutionName}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>{price === 0 ? 'Grátis' : formatBRL(price)}</Text>
            {price > 0 && <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 6 }}>pelo app</Text>}
          </View>
        </View>
      </Pressable>

      <View style={{ marginTop: 12 }}>
        <Button title={full ? 'Ver partida' : 'Confirmar presença'} variant={full ? 'secondary' : 'primary'} onPress={open} />
      </View>
    </View>
  );
}
