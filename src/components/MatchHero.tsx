import { Image, Text, View } from 'react-native';

import { colors } from '@/components/ui';

type Tone = 'success' | 'warn' | 'neutral';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.primary, fg: '#FFFFFF' },
  warn: { bg: colors.gold, fg: '#3B2A00' },
  neutral: { bg: 'rgba(255,255,255,0.9)', fg: colors.text },
};

/** Topo da partida: foto da quadra com título, local e situação da pessoa sobre a imagem. */
export default function MatchHero({
  photoUrl,
  title,
  subtitle,
  badge,
}: {
  photoUrl: string | null;
  title: string;
  subtitle: string;
  badge?: { label: string; tone: Tone };
}) {
  return (
    <View style={{ height: 240, backgroundColor: colors.navy, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <>
          <View style={{ position: 'absolute', right: -60, top: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.primary, opacity: 0.22 }} />
          <View style={{ position: 'absolute', left: -70, top: 60, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.navy2 }} />
          <Text style={{ position: 'absolute', right: 28, top: 26, fontSize: 64, opacity: 0.9 }}>⚽</Text>
        </>
      )}
      {/* escurece a parte de baixo para o texto ficar legível */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, backgroundColor: 'rgba(8,22,15,0.62)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(8,22,15,0.12)' }} />

      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
        {badge && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: TONES[badge.tone].bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 8 }}>
            <Text style={{ color: TONES[badge.tone].fg, fontSize: 12, fontWeight: '800' }}>{badge.label}</Text>
          </View>
        )}
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', lineHeight: 33 }} numberOfLines={2}>
          {title}
        </Text>
        <Text style={{ color: '#D1FAE5', marginTop: 2, fontSize: 14 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

/** Linha de informação com ícone (data, local, regras). */
export function InfoRow({ glyph, label, value, sub }: { glyph: string; label: string; value: string; sub?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Text style={{ fontSize: 20 }}>{glyph}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>{label}</Text>
        <Text style={{ fontSize: 16, color: colors.text, fontWeight: '800' }}>{value}</Text>
        {sub ? <Text style={{ fontSize: 13, color: colors.muted }}>{sub}</Text> : null}
      </View>
    </View>
  );
}
