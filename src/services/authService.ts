import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SERVER_URL, FALLBACK_LOCAL_SERVER_URL, obtenerServerUrl, guardarInspectorActivo } from './offlineSync';

// Nota: SecureStore solo acepta llaves alfanuméricas, '.', '-' y '_' (sin '@')
const SECURE_KEYS = {
  AUTH_TOKEN: 'sifygsa_auth_token_v1',
  AUTH_USER: 'sifygsa_auth_user_v1',
};

export interface UsuarioMovil {
  email: string;
  nombreCompleto: string;
  rol: string;
  cargo: string;
  departamento: string;
}

export interface SesionPersistente {
  token: string;
  user: UsuarioMovil;
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web') {
    const disponible = await SecureStore.isAvailableAsync().catch(() => false);
    if (disponible) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  }
  await AsyncStorage.setItem(`@fallback_${key}`, value);
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const disponible = await SecureStore.isAvailableAsync().catch(() => false);
    if (disponible) {
      return await SecureStore.getItemAsync(key);
    }
  }
  return await AsyncStorage.getItem(`@fallback_${key}`);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS !== 'web') {
    const disponible = await SecureStore.isAvailableAsync().catch(() => false);
    if (disponible) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
  }
  await AsyncStorage.removeItem(`@fallback_${key}`);
}

export async function obtenerTokenGuardado(): Promise<string | null> {
  try {
    return await secureGet(SECURE_KEYS.AUTH_TOKEN);
  } catch {
    return null;
  }
}

export async function obtenerSesionPersistente(): Promise<SesionPersistente | null> {
  try {
    const token = await secureGet(SECURE_KEYS.AUTH_TOKEN);
    const rawUser = await secureGet(SECURE_KEYS.AUTH_USER);
    if (!token || !rawUser) return null;

    const user = JSON.parse(rawUser) as UsuarioMovil;
    if (!user?.email) return null;

    return { token, user };
  } catch {
    return null;
  }
}

async function fetchConTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Autentica al inspector contra SIFYGSAFLEET (/api/mobile/login) y guarda
 * la sesión persistente cifrada en el Keystore nativo del dispositivo.
 */
export async function iniciarSesionCorporativa(
  email: string,
  password: string,
  customServerUrl?: string
): Promise<{
  ok: boolean;
  sesion?: SesionPersistente;
  error?: string;
}> {
  const configuredUrl = customServerUrl?.trim()
    ? customServerUrl.trim().replace(/\/+$/, '')
    : await obtenerServerUrl();

  const urlsToTry = Array.from(
    new Set([configuredUrl, DEFAULT_SERVER_URL, FALLBACK_LOCAL_SERVER_URL])
  );

  let ultimoErrorConexion = 'No se pudo conectar con el servidor SIFYGSAFLEET. Verifica tu conexión a internet.';

  for (const baseUrl of urlsToTry) {
    try {
      const res = await fetchConTimeout(
        `${baseUrl}/api/mobile/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        },
        10000
      );

      const data = await res.json().catch(() => null);

      if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 400) {
        return {
          ok: false,
          error: data?.error || 'Credenciales inválidas o cuenta no autorizada.',
        };
      }

      if (!res.ok || !data?.success || !data?.token || !data?.user) {
        ultimoErrorConexion = data?.error || `Respuesta inesperada del servidor (HTTP ${res.status}).`;
        continue;
      }

      const sesion: SesionPersistente = {
        token: data.token,
        user: data.user as UsuarioMovil,
      };

      await secureSet(SECURE_KEYS.AUTH_TOKEN, sesion.token);
      await secureSet(SECURE_KEYS.AUTH_USER, JSON.stringify(sesion.user));
      await guardarInspectorActivo(sesion.user.nombreCompleto);

      return { ok: true, sesion };
    } catch {
      // Intentar siguiente URL configurada
    }
  }

  return { ok: false, error: ultimoErrorConexion };
}

/**
 * Verifica silenciosamente en segundo plano si el token sigue vigente en SIFYGSAFLEET.
 * Si no hay internet, conserva la sesión persistente local sin interrumpir al inspector.
 * Solo devuelve revocada=true cuando el servidor responde explícitamente 401/403.
 */
export async function verificarVigenciaSesionRemota(): Promise<{
  revocada: boolean;
  motivo?: string;
  userActualizado?: UsuarioMovil;
}> {
  const token = await obtenerTokenGuardado();
  if (!token) {
    return { revocada: true, motivo: 'Sin sesión activa.' };
  }

  const configuredUrl = await obtenerServerUrl();
  const urlsToTry = Array.from(new Set([configuredUrl, DEFAULT_SERVER_URL]));

  for (const baseUrl of urlsToTry) {
    try {
      const res = await fetchConTimeout(
        `${baseUrl}/api/mobile/login`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
        6000
      );

      if (res.status === 401 || res.status === 403) {
        const data = await res.json().catch(() => null);
        return {
          revocada: true,
          motivo: data?.error || 'Tu sesión fue revocada o expiró en el servidor.',
        };
      }

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && data?.user) {
          await secureSet(SECURE_KEYS.AUTH_USER, JSON.stringify(data.user));
          await guardarInspectorActivo(data.user.nombreCompleto);
          return { revocada: false, userActualizado: data.user };
        }
      }
      return { revocada: false };
    } catch {
      // Sin internet o servidor inalcanzable: mantener sesión persistente offline
    }
  }

  return { revocada: false };
}

/**
 * Solicita un PIN temporal de 6 dígitos al correo corporativo en caso de olvido de contraseña.
 * Ese PIN se ingresa directamente en el campo de contraseña del Login.
 */
export async function solicitarPinRecuperacionMovil(
  email: string,
  customServerUrl?: string
): Promise<{ ok: boolean; mensaje: string }> {
  const configuredUrl = customServerUrl?.trim()
    ? customServerUrl.trim().replace(/\/+$/, '')
    : await obtenerServerUrl();

  const urlsToTry = Array.from(
    new Set([configuredUrl, DEFAULT_SERVER_URL, FALLBACK_LOCAL_SERVER_URL])
  );

  for (const baseUrl of urlsToTry) {
    try {
      const res = await fetchConTimeout(
        `${baseUrl}/api/mobile/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        },
        10000
      );

      const data = await res.json().catch(() => null);
      if (res.status === 429 || res.status === 400) {
        return {
          ok: false,
          mensaje: data?.error || 'Debes esperar antes de solicitar otro PIN.',
        };
      }

      if (res.ok && data?.success) {
        return {
          ok: true,
          mensaje:
            'Te enviamos un PIN temporal de 6 dígitos a tu correo. Escríbelo en el campo "Contraseña" (válido por 10 minutos).',
        };
      }
    } catch {
      // probar siguiente URL
    }
  }

  return {
    ok: false,
    mensaje: 'No hubo conexión con el servidor. También puedes pedir a Administración que restablezca tu clave en SIFYGSAFLEET.',
  };
}

/**
 * Elimina las credenciales seguras del dispositivo y purga el catálogo sensible en caché.
 * Nota: conserva la cola de checklists pendientes a menos que se solicite purga total.
 */
export async function cerrarSesionDispositivo(): Promise<void> {
  await secureDelete(SECURE_KEYS.AUTH_TOKEN);
  await secureDelete(SECURE_KEYS.AUTH_USER);
  await AsyncStorage.removeItem('@sifygsa_catalogo_vehiculos_v1');
  await AsyncStorage.removeItem('@sifygsa_last_catalog_sync_v1');
}

