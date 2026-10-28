import { VehiculoCatalogo } from '../types/checklist';

// Por seguridad corporativa, el APK no incluye placas, series (VIN) ni pólizas estáticas.
// El catálogo se descarga cifrado/autenticado en el primer inicio de sesión y se guarda en caché local.
export const VEHICULOS_SEED: VehiculoCatalogo[] = [];

export type NivelAlerta = 'OK' | 'WARNING' | 'EXPIRED' | 'SIN_DATO';

export interface DiagnosticoVigencia {
  titulo: string;
  referencia: string;
  fechaVencimiento: string;
  diasRestantes: number | null;
  nivel: NivelAlerta;
  mensaje: string;
}

export function evaluarFechaVigencia(
  titulo: string,
  referencia: string,
  fechaISO?: string | null,
  diasAviso = 30
): DiagnosticoVigencia {
  if (!fechaISO) {
    return {
      titulo,
      referencia: referencia || 'Sin número registrado',
      fechaVencimiento: 'No registrada',
      diasRestantes: null,
      nivel: 'SIN_DATO',
      mensaje: 'Falta registrar fecha de vencimiento',
    };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vto = new Date(`${fechaISO}T00:00:00`);
  if (isNaN(vto.getTime())) {
    return {
      titulo,
      referencia,
      fechaVencimiento: fechaISO,
      diasRestantes: null,
      nivel: 'SIN_DATO',
      mensaje: 'Formato de fecha no válido',
    };
  }

  const diffMs = vto.getTime() - hoy.getTime();
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0) {
    return {
      titulo,
      referencia,
      fechaVencimiento: fechaISO,
      diasRestantes: dias,
      nivel: 'EXPIRED',
      mensaje: `VENCIDO hace ${Math.abs(dias)} días (${fechaISO})`,
    };
  }

  if (dias <= diasAviso) {
    return {
      titulo,
      referencia,
      fechaVencimiento: fechaISO,
      diasRestantes: dias,
      nivel: 'WARNING',
      mensaje: `PRÓXIMO A VENCER en ${dias} días (${fechaISO})`,
    };
  }

  return {
    titulo,
    referencia,
    fechaVencimiento: fechaISO,
    diasRestantes: dias,
    nivel: 'OK',
    mensaje: `VIGENTE — Vence en ${dias} días (${fechaISO})`,
  };
}
