import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import CourtCard from '@/components/CourtCard';
import { Banner, Card, Chip, ChipRow, Muted, Screen, Spinner, TextField } from '@/components/ui';
import { addDays, CourtCardData, loadCourtCards, toISODate } from '@/lib/courts';

type DayFilter = 'any' | 'today' | 'tomorrow';

export default function BuscarQuadras() {
  const [courts, setCourts] = useState<CourtCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<DayFilter>('any');

  useFocusEffect(
    useCallback(() => {
      loadCourtCards()
        .then((c) => {
          setCourts(c);
          setError(false);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, []),
  );

  if (loading) return <Spinner />;

  const q = query.trim().toLowerCase();
  const dayISO = day === 'today' ? toISODate(new Date()) : day === 'tomorrow' ? toISODate(addDays(new Date(), 1)) : null;
  const list = courts.filter((c) => {
    const text = `${c.institutionName} ${c.courtName} ${c.city} ${c.sport}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (dayISO && !c.openByDate[dayISO]) return false;
    return true;
  });

  return (
    <Screen>
      <TextField label="Buscar por nome ou cidade" value={query} onChangeText={setQuery} placeholder="Ex.: Arena Central, Curitiba" />
      <ChipRow>
        <Chip label="Qualquer dia" selected={day === 'any'} onPress={() => setDay('any')} />
        <Chip label="Hoje" selected={day === 'today'} onPress={() => setDay('today')} />
        <Chip label="Amanhã" selected={day === 'tomorrow'} onPress={() => setDay('tomorrow')} />
      </ChipRow>
      {error && <Banner>Não foi possível carregar as quadras.</Banner>}
      {!error && list.length === 0 && (
        <Card>
          <Muted>Nenhuma quadra encontrada com esses filtros.</Muted>
        </Card>
      )}
      <View>
        {list.map((c) => (
          <CourtCard key={c.courtId} data={c} />
        ))}
      </View>
    </Screen>
  );
}
