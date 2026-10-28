import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { DEFAULT_SERVER_URL, FALLBACK_LOCAL_SERVER_URL, obtenerServerUrl } from './offlineSync';

export interface InfoActualizacionApp {
  version: string;
  fileName: string;
  sizeBytes: number;
  notas: string;
  obligatoria: boolean;
  fechaPublicacion: string;
  downloadUrl: string;
}

export function obtenerVersionActualApp(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

export function esVersionMayor(remota: string, local: string): boolean {
  const limpiar = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const r = limpiar(remota);
  const l = limpiar(local);
  const maxLen = Math.max(r.length, l.length, 3);

  for (let i = 0; i < maxLen; i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

export async function buscarActualizacionServidor(): Promise<{
  hayActualizacion: boolean;
  versionInstalada: string;
  release: InfoActualizacionApp | null;
}> {
  const versionInstalada = obtenerVersionActualApp();
  const configuredUrl = await obtenerServerUrl();
  const urlsToTry = Array.from(
    new Set([configuredUrl, DEFAULT_SERVER_URL, FALLBACK_LOCAL_SERVER_URL])
  );

  for (const baseUrl of urlsToTry) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${baseUrl}/api/mobile/version`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!res.ok) continue;

      const data = await res.json();
      if (data?.success && data?.latest?.version) {
        const latest = data.latest as InfoActualizacionApp;
        // Asegurar que downloadUrl use el baseUrl funcional si venía con otro host interno
        const downloadUrl = latest.downloadUrl?.startsWith('http')
          ? latest.downloadUrl
          : `${baseUrl}/api/mobile/version/download?v=${encodeURIComponent(latest.version)}`;

        const releaseNormalizado: InfoActualizacionApp = {
          ...latest,
          downloadUrl,
        };

        return {
          hayActualizacion: esVersionMayor(latest.version, versionInstalada),
          versionInstalada,
          release: releaseNormalizado,
        };
      }
      break;
    } catch {
      // Probar siguiente URL
    }
  }

  return {
    hayActualizacion: false,
    versionInstalada,
    release: null,
  };
}

/**
 * Descarga el instalador APK en caché con progreso real (0% - 100%)
 * y lanza el instalador nativo de Android conservando sesión y checklists locales.
 */
export async function descargarEInstalarActualizacion(
  release: InfoActualizacionApp,
  onProgress?: (porcentaje: number, descargadoMB: string, totalMB: string) => void
): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS !== 'android') {
    await Linking.openURL(release.downloadUrl);
    return { ok: true };
  }

  try {
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!baseDir) {
      await Linking.openURL(release.downloadUrl);
      return { ok: true };
    }

    const localUri = `${baseDir}SIFYGSA-Checklist-v${release.version}.apk`;

    // Eliminar archivo previo si existía incompleto
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});

    const totalFallbackBytes = release.sizeBytes || 82 * 1024 * 1024;

    const downloadResumable = FileSystem.createDownloadResumable(
      release.downloadUrl,
      localUri,
      {},
      (progress) => {
        const total =
          progress.totalBytesExpectedToWrite > 0
            ? progress.totalBytesExpectedToWrite
            : totalFallbackBytes;
        const pct = Math.min(100, Math.max(0, Math.round((progress.totalBytesWritten / total) * 100)));
        const descMB = (progress.totalBytesWritten / (1024 * 1024)).toFixed(1);
        const totMB = (total / (1024 * 1024)).toFixed(1);
        onProgress?.(pct, descMB, totMB);
      }
    );

    const resultado = await downloadResumable.downloadAsync();
    if (!resultado?.uri) {
      throw new Error('La descarga del instalador APK no se completó.');
    }

    onProgress?.(100, (release.sizeBytes / (1024 * 1024)).toFixed(1), (release.sizeBytes / (1024 * 1024)).toFixed(1));

    // Convertir file:// URI a content:// URI segura para Android 7 - Android 15
    const contentUri = await FileSystem.getContentUriAsync(resultado.uri);

    // FLAG_GRANT_READ_URI_PERMISSION = 1 | FLAG_ACTIVITY_NEW_TASK = 268435456
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: 'application/vnd.android.package-archive',
    });

    return { ok: true };
  } catch (err: any) {
    // Fallback confiable: abrir descarga directa en el navegador del sistema
    try {
      await Linking.openURL(release.downloadUrl);
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: err?.message || 'No se pudo iniciar la instalación del APK.',
      };
    }
  }
}
