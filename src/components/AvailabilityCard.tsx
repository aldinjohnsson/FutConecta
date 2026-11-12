import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Banner, Button, Card, colors, Muted, TextField } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { setAvailability } from '@/lib/players';
import { useAuth } from '@/providers/AuthProvider';

/**
 * "Estou disponível para jogo": botão liga/desliga com confirmação.
 * Quem liga aparece em Buscar Jogadores (nome, idade, cidade, posições). Vale para qualquer
 * conta, seja jogador, organizador ou dono de quadra.
 */
export default function AvailabilityCard({ compact = false, onChanged }: { compact?: boolean; onChanged?: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const available = Boolean(profile?.available_to_play);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setNote(profile?.available_note ?? '');
  }, [profile?.available_note]);

  function explain(err: { message: string }): string {
    // função ainda não criada no banco (migration não aplicada)
    if (/set_availability|schema cache|does not exist/i.test(err.message)) {
      return 'Recurso indisponível: aplique a migration de disponibilidade no Supabase.';
    }
    return err.message;
  }

  async function toggle(next: boolean) {
    setMessage(null);
    const yes = await confirmAction(
      next
        ? 'Aparecer na lista de jogadores disponíveis? Outros jogadores e organizadores vão ver seu nome, idade, cidade, posições e pé dominante. Seu e-mail não é exibido. Você pode desativar quando quiser.'
        : 'Sair da lista de jogadores disponíveis? Você deixa de aparecer em Buscar Jogadores.',
      next ? 'Ficar disponível' : 'Desativar',
    );
    if (!yes) return;
    setBusy(true);
    const { error } = await setAvailability(next, next ? note : null);
    if (error) {
      setBusy(false);
      return setMessage({ kind: 'error', text: explain(error) });
    }
    await refreshProfile();
    setBusy(false);
    setMessage({ kind: 'info', text: next ? 'Pronto! Você está na lista de jogadores disponíveis.' : 'Você saiu da lista.' });
    onChanged?.();
  }

  async function saveNote() {
    setMessage(null);
    setBusy(true);
    const { error } = await setAvailability(true, note);
    if (error) {
      setBusy(false);
      return setMessage({ kind: 'error', text: explain(error) });
    }
    await refreshProfile();
    setBusy(false);
    setMessage({ kind: 'info', text: 'Recado atualizado.' });
    onChanged?.();
  }

  const missing = !(profile?.positions?.length) || !profile?.city;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Estou disponível para jogo</Text>
          <Muted>
            {available
              ? 'Você aparece em Buscar Jogadores.'
              : compact
                ? 'Apareça para organizadores e jogadores.'
                : 'Ligue para aparecer na lista de Buscar Jogadores e receber convites.'}
          </Muted>
        </View>
        <Switch
          accessibilityLabel="Estou disponível para jogo"
          value={available}
          disabled={busy}
          onValueChange={toggle}
          trackColor={{ false: '#CBD5E1', true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {message && (
        <View style={{ marginTop: 10 }}>
          <Banner kind={message.kind}>{message.text}</Banner>
        </View>
      )}

      {!compact && missing && (
        <View style={{ marginTop: 10 }}>
          <Banner kind="warn">Preencha cidade e posições no seu perfil para que organizadores achem você mais fácil.</Banner>
        </View>
      )}

      {!compact && available && (
        <View style={{ marginTop: 12 }}>
          <TextField
            label="Recado (opcional)"
            value={note}
            onChangeText={setNote}
            maxLength={140}
            placeholder="Ex.: jogo à noite, de terça a quinta"
          />
          <Button title="Salvar recado" variant="secondary" onPress={saveNote} loading={busy} />
        </View>
      )}
    </Card>
  );
}
