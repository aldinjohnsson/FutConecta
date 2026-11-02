import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdBanner from '@/components/AdBanner';
import CourtCard from '@/components/CourtCard';
import PlayerCard from '@/components/PlayerCard';
import { Badge, Button, Card, colors, Muted, SectionHeader, Spinner } from '@/components/ui';
import { CourtCardData, loadCourtCards } from '@/lib/courts';
import { formatSlotWhen } from '@/lib/format';
import { loadMyMatches, MyMatch } from '@/lib/myMatches';
import { WEEKDAY_SHORT } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

export default function Inicio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, session } = useAuth();
  const [courts, setCourts] = useState<CourtCardData[]>([]);
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const [c, m] = await Promise.all([loadCourtCards().catch(() => []), loadMyMatches(session.user.id)]);
    setCourts(c);
    setMatches(m);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const inner = Math.min(width, 720) - 32;
  const cols = inner >= 600 ? 2 : 1;
  const gap = 14;
  const cardWidth = cols === 2 ? (inner - gap) / 2 : inner;

  // quadras com horário aberto primeiro (hoje > amanhã > depois)
  const sorted = [...courts].sort((a, b) => (Object.keys(a.openByDate).sort()[0] ?? '9') .localeCompare(Object.keys(b.openByDate).sort()[0] ?? '9'));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 24 }}>
      <View style={{ width: '100%', backgroundColor: colors.navy, paddingTop: insets.top + 14, paddingBottom: 54, alignItems: 'center', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <View style={{ width: '100%', maxWidth: 720, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: colors.sky, fontWeight: '700', fontSize: 13 }}>Bem-vindo</Text>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>Olá, {firstName || 'jogador'} 👋</Text>
            <Text style={{ color: '#B8C7E8', marginTop: 2 }}>Bora jogar hoje?</Text>
          </View>
          <Pressable onPress={() => router.push('/perfil')} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.navy2, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>{(profile?.full_name ?? '?').slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ width: '100%', maxWidth: 720, paddingHorizontal: 16, marginTop: -34 }}>
        <AdBanner />

        {profile && <PlayerCard profile={profile} onPressProfile={() => router.push('/perfil')} />}

        <View style={{ height: 8 }} />
        <SectionHeader title="Meus horários e grupos" action={matches.length ? 'Ver todos' : undefined} onAction={() => router.push('/partidas')} />
        {loading ? (
          <Spinner />
        ) : matches.length === 0 ? (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.text }}>Você ainda não tem horários marcados</Text>
            <Muted>Escolha uma quadra abaixo, crie uma partida ou entre em uma já aberta.</Muted>
            <View style={{ height: 8 }} />
            <Button title="Ver partidas abertas" variant="secondary" onPress={() => router.push('/partidas')} />
          </Card>
        ) : (
          matches.slice(0, 3).map((m) => (
            <Pressable key={m.id} onPress={() => router.push(`/partidas/${m.id}`)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ backgroundColor: colors.primarySoft, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>{m.slotDate.split('-')[2]}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                    {WEEKDAY_SHORT[new Date(`${m.slotDate}T12:00:00`).getDay()].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }} numberOfLines={1}>
                    {m.title || 'Partida'}
                  </Text>
                  <Muted>
                    {formatSlotWhen(m.slotDate, m.startTime, WEEKDAY_SHORT).split(' · ')[1]} · {m.institutionName}
                  </Muted>
                  <View style={{ marginTop: 6 }}>
                    <Badge label={m.role === 'organizer' ? 'Você organiza' : 'Você joga'} tone={m.role === 'organizer' ? 'warn' : 'info'} />
                  </View>
                </View>
                <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
              </Card>
            </Pressable>
          ))
        )}

        <SectionHeader title="Quadras disponíveis" action="Ver todas" onAction={() => router.push('/explorar')} />
        {loading ? (
          <Spinner />
        ) : sorted.length === 0 ? (
          <Card>
            <Muted>Nenhuma quadra cadastrada ainda.</Muted>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {sorted.slice(0, 6).map((c) => (
              <CourtCard key={c.courtId} data={c} width={cardWidth} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
