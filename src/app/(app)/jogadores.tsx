import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import AvailabilityCard from '@/components/AvailabilityCard';
import { Badge, Banner, Card, Chip, ChipRow, colors, Label, Muted, Screen, Spinner, Subtitle, TextField, Title } from '@/components/ui';
import { AvailablePlayer, loadAvailablePlayers } from '@/lib/players';
import { FOOT_LABEL, POSITION_LABEL, PlayerPosition } from '@/lib/types';

const POSITIONS = Object.keys(POSITION_LABEL) as PlayerPosition[];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function sinceLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `Disponível desde ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function PlayerRow({ p }: { p: AvailablePlayer }) {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {p.photoUrl ? (
        <Image source={{ uri: p.photoUrl }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft }} />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.navy2, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{initials(p.fullName)}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }} numberOfLines={1}>
          {p.fullName}
        </Text>
        <Muted>
          {[p.age !== null ? `${p.age} anos` : null, p.city ? `📍 ${p.city}` : null, p.foot ? `Pé ${FOOT_LABEL[p.foot].toLowerCase()}` : null]
            .filter(Boolean)
            .join(' · ') || 'Sem detalhes no perfil'}
        </Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {p.positions.length === 0 ? (
            <Badge label="Posição não informada" tone="neutral" />
          ) : (
            p.positions.map((pos) => <Badge key={pos} label={POSITION_LABEL[pos] ?? pos} tone="info" />)
          )}
        </View>
        {p.note ? <Text style={{ color: colors.text, marginTop: 8, fontStyle: 'italic' }}>“{p.note}”</Text> : null}
        {p.since ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{sinceLabel(p.since)}</Text> : null}
      </View>
    </Card>
  );
}

export default function Jogadores() {
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const [city, setCity] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [players, setPlayers] = useState<AvailablePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // espera a pessoa parar de digitar a cidade antes de buscar
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(city), 400);
    return () => clearTimeout(t);
  }, [city]);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPlayers(await loadAvailablePlayers({ position, city: debouncedCity }));
    } catch (e) {
      const msg = (e as { message?: string }).message ?? '';
      setError(
        /list_available_players|schema cache|does not exist/i.test(msg)
          ? 'Recurso indisponível: aplique a migration de disponibilidade no Supabase.'
          : 'Não foi possível carregar os jogadores. Tente de novo.',
      );
    }
    setLoading(false);
  }, [position, debouncedCity]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <Title>Buscar jogadores</Title>
      <Subtitle>Jogadores que estão disponíveis para entrar em uma partida.</Subtitle>

      <AvailabilityCard compact onChanged={load} />

      <Label>Posição</Label>
      <ChipRow>
        <Chip label="Todas" selected={position === null} onPress={() => setPosition(null)} />
        {POSITIONS.map((p) => (
          <Chip key={p} label={POSITION_LABEL[p]} selected={position === p} onPress={() => setPosition(position === p ? null : p)} />
        ))}
      </ChipRow>
      <TextField label="Cidade" value={city} onChangeText={setCity} placeholder="Filtrar por cidade" />

      {error && <Banner>{error}</Banner>}
      {loading ? (
        <Spinner />
      ) : (
        <>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
            {players.length} jogador{players.length === 1 ? '' : 'es'} disponíve{players.length === 1 ? 'l' : 'is'}
          </Text>
          {players.length === 0 && !error && (
            <Card>
              <Muted>Ninguém disponível com esses filtros agora. Tente outra posição ou cidade.</Muted>
            </Card>
          )}
          {players.map((p) => (
            <PlayerRow key={p.id} p={p} />
          ))}
        </>
      )}
    </Screen>
  );
}
