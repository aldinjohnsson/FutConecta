import { Alert, Platform } from 'react-native';

/** Confirmação que funciona no navegador (Alert.alert não tem botões na web) e no celular. */
export function confirmAction(message: string, confirmLabel = 'Confirmar'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
  }
  return new Promise((resolve) => {
    Alert.alert('Confirmar', message, [
      { text: 'Voltar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
