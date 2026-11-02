import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { colors } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { FOOT_LABEL, Profile } from '@/lib/types';

interface Stats {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
}
const EMPTY: Stats = { games: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0 };

const POS_CODE: Record<string, string> = { goalkeeper: 'GOL', defender: 'ZAG', midfielder: 'MEI', forward: 'ATA' };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Cartão do jogador (estilo carta de futebol). Estatísticas são lançadas pelo organizador/admin. */
export default function PlayerCard({ profile, onPressProfile }: { profile: Profile; onPressProfile?: () => void }) {
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => {
    supabase
      .from('player_stats_manual')
      .select('games,wins,draws,losses,goals,assists')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => setStats((data as Stats | null) ?? EMPTY));
  }, [profile.id]);

  const pos = profile.positions?.[0] ? POS_CODE[profile.positions[0]] : '—';
  const cells: [string, number][] = [
    ['VIT', stats.wins],
    ['GOLS', stats.goals],
    ['ASS', stats.assists],
    ['EMP', stats.draws],
    ['DER', stats.losses],
    ['POS', 0],
  ];

  return (
    <Pressable onPress={onPressProfile} disabled={!onPressProfile}>
      <View style={{ backgroundColor: colors.navy, borderRadius: 24, padding: 18, borderWidth: 2, borderColor: colors.gold, overflow: 'hidden' }}>
        {/* detalhes decorativos */}
        <View style={{ position: 'absolute', right: -50, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.navy2, opacity: 0.8 }} />
        <View style={{ position: 'absolute', left: -40, bottom: -60, width: 150, height: 150, borderRadius: 75, backgroundColor: colors.navy2, opacity: 0.5 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ alignItems: 'center', width: 84 }}>
            <Text style={{ color: colors.gold, fontSize: 44, fontWeight: '900', lineHeight: 48 }}>{stats.games}</Text>
            <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>JOGOS</Text>
            <View style={{ height: 1, width: 36, backgroundColor: colors.gold, opacity: 0.5, marginVertical: 8 }} />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{pos}</Text>
          </View>

          <View style={{ flex: 1, alignItems: 'center' }}>
            {profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: colors.gold }} />
            ) : (
              <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.navy2, borderWidth: 3, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{initials(profile.full_name)}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>
          {profile.full_name}
        </Text>
        <Text style={{ color: colors.sky, textAlign: 'center', fontSize: 12, marginTop: 2 }}>
          {[profile.city, profile.preferred_foot ? `Pé ${FOOT_LABEL[profile.preferred_foot].toLowerCase()}` : null].filter(Boolean).join(' · ') || 'Complete seu perfil'}
        </Text>

        <View style={{ height: 1, backgroundColor: colors.gold, opacity: 0.4, marginVertical: 12 }} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells
            .filter(([label]) => label !== 'POS')
            .map(([label, value]) => (
              <View key={label} style={{ width: '20%', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{value}</Text>
                <Text style={{ color: colors.sky, fontSize: 11, fontWeight: '700' }}>{label}</Text>
              </View>
            ))}
        </View>

        {onPressProfile && <Text style={{ color: colors.gold, textAlign: 'center', fontWeight: '800', marginTop: 14, fontSize: 13 }}>Ver perfil →</Text>}
      </View>
    </Pressable>
  );
}
