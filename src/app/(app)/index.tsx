import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdBanner from '@/components/AdBanner';
import CourtRow from '@/components/CourtRow';
import FeaturedMatchCard from '@/components/FeaturedMatchCard';
import { Banner, Button, Card, colors, Muted, SectionHeader, Spinner } from '@/components/ui';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { CourtCardData, loadCourtCards } from '@/lib/courts';
import { FeaturedMatch, loadFeaturedMatches } from '@/lib/featured';
import { usePlatformCommissionBps } from '@/lib/usePlatformCommission';
import { useAuth } from '@/providers/AuthProvider';
import { useMode } from '@/providers/ModeProvider';

interface QuickAction {
  glyph: string;
  label: string;
  /** rota; sem rota = ainda não disponível */
  href?: '/explorar' | '/partidas';
  soon?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { glyph: '📅', label: 'Criar Partida', href: '/explorar' },
  { glyph: '🏟️', label: 'Quadras', href: '/explorar' },
  { glyph: '👥', label: 'Buscar Jogadores', soon: 'A busca de jogadores chega em breve.' },
  { glyph: '👑', label: 'Planos', soon: 'Os planos chegam em breve.' },
];

export default function Inicio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useMode();
  const { profile, session } = useAuth();
  const commissionBps = usePlatformCommissionBps();

  const [courts, setCourts] = useState<CourtCardData[]>([]);
  const [featured, setFeatured] = useState<FeaturedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [c, f] = await Promise.all([loadCourtCards().catch(() => []), loadFeaturedMatches().catch(() => [])]);
    setCourts(c);
    setFeatured(f);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // no modo Dono a tela inicial é a Agenda da quadra
  if (mode === 'owner') return <Redirect href="/agenda" />;

  // quadras da cidade do jogador primeiro; depois as com horário aberto mais cedo
  const myCity = (profile?.city ?? '').trim().toLowerCase();
  const nearby = [...courts].sort((a, b) => {
    const ca = myCity && a.city.trim().toLowerCase() === myCity ? 0 : 1;
    const cb = myCity && b.city.trim().toLowerCase() === myCity ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return (Object.keys(a.openByDate).sort()[0] ?? '9').localeCompare(Object.keys(b.openByDate).sort()[0] ?? '9');
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 28 }}>
      {/* Hero */}
      <View style={{ width: '100%', backgroundColor: colors.navy, paddingTop: insets.top + 14, paddingBottom: 78, alignItems: 'center', overflow: 'hidden' }}>
        {/* luzes de estádio (decorativo) */}
        <View style={{ position: 'absolute', right: -70, top: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.primary, opacity: 0.22 }} />
        <View style={{ position: 'absolute', left: -90, top: 70, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.navy2, opacity: 0.9 }} />
        <View style={{ position: 'absolute', right: 30, bottom: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.primary, opacity: 0.12 }} />

        <View style={{ width: '100%', maxWidth: 720, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.primary }}>
                <Text style={{ fontSize: 24 }}>⚽</Text>
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.3 }}>{BRAND_NAME}</Text>
                <Text style={{ color: '#B7E4C7', fontSize: 12 }}>{BRAND_TAGLINE}</Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel="Notificações"
              onPress={() => setNotice('As notificações chegam em breve.')}
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <Text style={{ fontSize: 20 }}>🔔</Text>
            </Pressable>
          </View>

          <Text style={{ color: '#fff', fontSize: 27, fontWeight: '900', lineHeight: 33, marginTop: 26 }}>
            Encontre partidas.{'\n'}Monte seu time.{'\n'}Reserve sua quadra.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/partidas')}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 13,
              borderRadius: 999,
              marginTop: 20,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔎</Text>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Buscar partidas</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ width: '100%', maxWidth: 720, paddingHorizontal: 16, marginTop: -44 }}>
        {/* Ações rápidas */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.card,
            borderRadius: 20,
            paddingVertical: 16,
            paddingHorizontal: 6,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#08160F',
            shadowOpacity: 0.1,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => (a.href ? router.push(a.href) : setNotice(a.soon ?? null))}
              style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{a.glyph}</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 6 }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {notice && <Banner kind="info">{notice}</Banner>}

        {/* Partidas em destaque */}
        <SectionHeader title="Partidas em destaque" action="Ver todas" onAction={() => router.push('/partidas')} />
        {loading ? (
          <Spinner />
        ) : featured.length === 0 ? (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.text }}>Nenhuma partida aberta no momento</Text>
            <Muted>Escolha uma quadra, reserve um horário e convide a galera.</Muted>
            <View style={{ height: 8 }} />
            <Button title="Ver quadras" onPress={() => router.push('/explorar')} />
          </Card>
        ) : (
          featured.slice(0, 3).map((m) => <FeaturedMatchCard key={m.id} data={m} commissionBps={commissionBps} />)
        )}

        <AdBanner />

        {/* Quadras próximas */}
        <SectionHeader title="Quadras próximas" action="Ver todas" onAction={() => router.push('/explorar')} />
        {loading ? (
          <Spinner />
        ) : nearby.length === 0 ? (
          <Card>
            <Muted>Nenhuma quadra cadastrada ainda.</Muted>
          </Card>
        ) : (
          nearby.slice(0, 4).map((c) => <CourtRow key={c.courtId} data={c} />)
        )}
      </View>
    </ScrollView>
  );
}
