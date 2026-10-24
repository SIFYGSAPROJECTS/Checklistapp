import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChecklistFormState, VehiculoCatalogo } from '../types/checklist';
import { VEHICULOS_SEED } from '../utils/vigencias';

const STORAGE_KEYS = {
  CATALOGO_VEHICULOS: '@sifygsa_catalogo_vehiculos_v1',
  COLA_CHECKLISTS: '@sifygsa_cola_checklists_v1',
  SERVER_URL: '@sifygsa_server_url_v1',
  INSPECTOR_NOMBRE: '@sifygsa_inspector_nombre_v1',
  LAST_CATALOG_SYNC: '@sifygsa_last_catalog_sync_v1',
};

export const DEFAULT_SERVER_URL = 'https://cloud.sifygsa.com';
export const FALLBACK_LOCAL_SERVER_URL = 'http://localhost:3001';

async function fetchConTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function obtenerServerUrl(): Promise<string> {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
  return saved ? saved.replace(/\/+$/, '') : FALLBACK_LOCAL_SERVER_URL;
}

export async function guardarServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, url.trim().replace(/\/+$/, ''));
}

export async function obtenerInspectorActivo(): Promise<string> {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.INSPECTOR_NOMBRE);
  return saved || 'HERNAN OVALLES GARCIA';
}

export async function guardarInspectorActivo(nombre: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.INSPECTOR_NOMBRE, nombre.trim().toUpperCase());
}

/**
 * Obtiene el catálogo de vehículos desde caché local (Offline-First).
 * Si aún no se ha sincronizado nunca, devuelve las unidades semilla de tu hoja de revisión.
 */
export async function obtenerCatalogoLocal(): Promise<{
  vehiculos: VehiculoCatalogo[];
  lastSync: string | null;
}> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CATALOGO_VEHICULOS);
    const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CATALOG_SYNC);
    if (raw) {
      const parsed = JSON.parse(raw) as VehiculoCatalogo[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { vehiculos: parsed, lastSync };
      }
    }
  } catch (e) {
    console.warn('Error leyendo catálogo local:', e);
  }
  return { vehiculos: VEHICULOS_SEED, lastSync: null };
}

/**
 * Descarga el catálogo actualizado desde SIFYGSAFLEET (/api/mobile/catalogo)
 * y lo persiste localmente para uso sin internet.
 */
export async function sincronizarCatalogoDesdeServidor(): Promise<{
  ok: boolean;
  vehiculos: VehiculoCatalogo[];
  mensaje: string;
}> {
  const configuredUrl = await obtenerServerUrl();
  const urlsToTry = Array.from(
    new Set([
      FALLBACK_LOCAL_SERVER_URL,
      configuredUrl,
      DEFAULT_SERVER_URL,
    ])
  );

  for (const baseUrl of urlsToTry) {
    try {
      const res = await fetchConTimeout(
        `${baseUrl}/api/mobile/catalogo`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        6000
      );

      if (!res.ok) continue;

      const data = await res.json();
      if (data?.vehiculos && Array.isArray(data.vehiculos)) {
        const remotos: VehiculoCatalogo[] = data.vehiculos;
        const now = new Date().toISOString();
        await AsyncStorage.setItem(STORAGE_KEYS.CATALOGO_VEHICULOS, JSON.stringify(remotos));
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_CATALOG_SYNC, now);
        return {
          ok: true,
          vehiculos: remotos,
          mensaje: `☁️ ${remotos.length} unidades sincronizadas en vivo desde SIFYGSAFLEET`,
        };
      }
    } catch {
      // probar siguiente URL
    }
  }

  const local = await obtenerCatalogoLocal();
  return {
    ok: false,
    vehiculos: local.vehiculos,
    mensaje: `Modo Offline activo (usando ${local.vehiculos.length} unidades guardadas en el dispositivo)`,
  };
}

/**
 * Obtiene todos los checklists guardados en la tablet (pendientes, borradores y sincronizados).
 */
export async function obtenerColaChecklists(): Promise<ChecklistFormState[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.COLA_CHECKLISTS);
    if (!raw) return [];
    return JSON.parse(raw) as ChecklistFormState[];
  } catch (e) {
    return [];
  }
}

/**
 * Pre-guarda o actualiza un checklist en el almacenamiento local de la tablet.
 * También actualiza los datos del último checklist en el catálogo local de esa unidad
 * para que si le hacen otro checklist en modo offline, ya jale los datos más recientes.
 */
export async function guardarChecklistEnColaLocal(item: ChecklistFormState): Promise<ChecklistFormState[]> {
  const cola = await obtenerColaChecklists();
  const idx = cola.findIndex((c) => c.idLocal === item.idLocal);
  const actualizado: ChecklistFormState = {
    ...item,
    fechaGuardadoLocal: new Date().toISOString(),
  };

  if (idx >= 0) {
    cola[idx] = actualizado;
  } else {
    cola.unshift(actualizado);
  }

  await AsyncStorage.setItem(STORAGE_KEYS.COLA_CHECKLISTS, JSON.stringify(cola));

  // Actualizar en caché local del vehículo los datos de este último checklist
  const { vehiculos } = await obtenerCatalogoLocal();
  const vIdx = vehiculos.findIndex((v) => v.consecutivo === item.consecutivo);
  if (vIdx >= 0) {
    const kmNum = parseInt(String(item.kilometraje).replace(/\D/g, ''), 10);
    vehiculos[vIdx] = {
      ...vehiculos[vIdx],
      kilometrajeActual: !isNaN(kmNum) && kmNum > 0 ? kmNum : vehiculos[vIdx].kilometrajeActual,
      vencimientoPoliza: item.vencimientoSeguro || vehiculos[vIdx].vencimientoPoliza,
      vencimientoLicencia: item.licenciaManejo?.fechaVencimiento || vehiculos[vIdx].vencimientoLicencia,
      ultimoChecklistFecha: actualizado.fechaGuardadoLocal,
      ultimoChecklistFolio: item.folio,
      ultimoChecklistDatos: item,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.CATALOGO_VEHICULOS, JSON.stringify(vehiculos));
  }

  return cola;
}

export async function eliminarChecklistLocal(idLocal: string): Promise<ChecklistFormState[]> {
  const cola = await obtenerColaChecklists();
  const filtrada = cola.filter((c) => c.idLocal !== idLocal);
  await AsyncStorage.setItem(STORAGE_KEYS.COLA_CHECKLISTS, JSON.stringify(filtrada));
  return filtrada;
}

/**
 * Procesa la cola de checklists con estado 'PENDIENTE_SUBIR' o 'ERROR'
 * y los sube automáticamente a SIFYGSAFLEET (/api/mobile/sync-checklist) en cuanto hay internet.
 */
let sincronizandoEnCurso = false;

export async function sincronizarPendientesConServidor(
  onProgress?: (msg: string) => void,
  onColaChange?: (cola: ChecklistFormState[]) => void
): Promise<{ subidos: number; pendientes: number; errores: number }> {
  if (sincronizandoEnCurso) {
    return { subidos: 0, pendientes: 0, errores: 0 };
  }
  sincronizandoEnCurso = true;

  let subidos = 0;
  let errores = 0;

  try {
    const configuredUrl = await obtenerServerUrl();
    const urlsToTry = Array.from(
      new Set([
        FALLBACK_LOCAL_SERVER_URL,
        configuredUrl,
        DEFAULT_SERVER_URL,
      ])
    );
    const cola = await obtenerColaChecklists();
    const porSubir = cola.filter(
      (c) => c.estadoSync === 'PENDIENTE_SUBIR' || c.estadoSync === 'ERROR'
    );

    for (const item of porSubir) {
      let exitoItem = false;
      let ultimoError = 'Sin conexión con el servidor Easypanel';

      for (const baseUrl of urlsToTry) {
        try {
          onProgress?.(`Subiendo checklist ${item.consecutivo} (${item.folio}) a MinIO...`);

          const response = await fetchConTimeout(
            `${baseUrl}/api/mobile/sync-checklist`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            },
            20000
          );

          if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.error || errData?.detalle || `HTTP ${response.status}`);
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || 'Respuesta inválida del servidor');
          }

          // Marcar como SINCRONIZADO y purgar base64 pesado de fotos y firmas para no saturar la memoria del teléfono/tablet
          const itemSincronizado: ChecklistFormState = {
            ...item,
            estadoSync: 'SINCRONIZADO',
            pdfUrlRemoto: result.pdfUrl,
            errorSync: undefined,
            firmaResponsableBase64: item.firmaResponsableBase64 ? 'SINCRONIZADA' : null,
            firmaInspectorBase64: item.firmaInspectorBase64 ? 'SINCRONIZADA' : null,
            fotos: (item.fotos || []).map((f) => ({
              id: f.id,
              fase: f.fase,
              etiqueta: f.etiqueta,
              uriLocal: f.uriLocal,
            })),
          };

          const colaActualizada = await guardarChecklistEnColaLocal(itemSincronizado);
          onColaChange?.(colaActualizada);
          subidos++;
          exitoItem = true;
          break;
        } catch (err: any) {
          ultimoError = err?.message || 'Error de conexión';
        }
      }

      if (!exitoItem) {
        errores++;
        const itemConError: ChecklistFormState = {
          ...item,
          estadoSync: 'PENDIENTE_SUBIR',
          errorSync: ultimoError,
        };
        const colaActualizada = await guardarChecklistEnColaLocal(itemConError);
        onColaChange?.(colaActualizada);
      }
    }

    const colaFinal = await obtenerColaChecklists();
    const pendientes = colaFinal.filter((c) => c.estadoSync === 'PENDIENTE_SUBIR').length;
    return { subidos, pendientes, errores };
  } finally {
    sincronizandoEnCurso = false;
  }
}
