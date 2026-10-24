import { VehiculoCatalogo } from '../types/checklist';

export const VEHICULOS_SEED: VehiculoCatalogo[] = [
  {
    consecutivo: 'AVH-016',
    placas: 'YLN-733-A',
    marca: 'Ford',
    modelo: '2020',
    linea: 'Figo EN',
    color: 'Gris Mercurio',
    numeroSerie: 'MAJFP1M1LA198901',
    polizaSeguro: 'AXA-130243515201',
    vencimientoPoliza: '2026-11-15',
    vencimientoTarjeta: '2027-03-31',
    tieneTarjetaCirculacionDoc: true,
    tienePolizaDoc: true,
    bimestreVerificacion: 'RD / ABRIL-MAYO',
    estadoVerificacion: 'REALIZADO',
    fechaFinVerificacion: '2026-11-30',
    kilometrajeActual: 64250,
    estatusOperativo: 'Activo en flota',
    ubicacion: 'Matriz Veracruz',
    departamento: 'Operaciones',
    responsableEmail: 'zcm@sifygsa.com',
    responsableNombre: 'ZCM',
    vencimientoLicencia: '2027-06-20',
    ultimoChecklistFecha: '2026-02-25T10:00:00.000Z',
    ultimoChecklistFolio: 'CHK-AVH-016-001',
    ultimoChecklistDatos: null,
  },
  {
    consecutivo: 'AVH-002',
    placas: 'XX-30120',
    marca: 'FORD',
    modelo: '2017',
    linea: 'Ranger',
    color: 'PLATA ESTELAR',
    numeroSerie: '8AFWR5AA8H6467706',
    polizaSeguro: 'AXA - 120288505700',
    vencimientoPoliza: '2026-01-20', // Vencida para demostrar alerta roja
    vencimientoTarjeta: '2026-12-31',
    tieneTarjetaCirculacionDoc: true,
    tienePolizaDoc: true,
    bimestreVerificacion: 'MAYO/JUNIO',
    estadoVerificacion: 'PENDIENTE',
    fechaFinVerificacion: '2026-06-30',
    kilometrajeActual: 118400,
    estatusOperativo: 'Activo en flota',
    ubicacion: 'Campo / Proyectos',
    departamento: 'Ingeniería',
    responsableEmail: 'egarcia@sifygsa.com',
    responsableNombre: 'ERWIN GARCIA CARRASCO',
    vencimientoLicencia: '2026-11-05', // Próxima a vencer
    ultimoChecklistFecha: '2026-02-25T10:00:00.000Z',
    ultimoChecklistFolio: 'CHK-AVH-002-004',
    ultimoChecklistDatos: null,
  },
  {
    consecutivo: 'AVH-003',
    placas: 'YLF-6331',
    marca: 'FORD',
    modelo: '2017',
    linea: 'Figo IM',
    color: 'PLATA ESTELAR',
    numeroSerie: 'MAJFP1MD4HA131923',
    polizaSeguro: 'AXA - 120288498900',
    vencimientoPoliza: '2027-01-20',
    vencimientoTarjeta: '2027-05-15',
    tieneTarjetaCirculacionDoc: true,
    tienePolizaDoc: true,
    bimestreVerificacion: 'OCTUBRE/NOVIEMBRE',
    estadoVerificacion: 'PENDIENTE',
    fechaFinVerificacion: '2026-11-30',
    kilometrajeActual: 95320,
    estatusOperativo: 'Activo en flota',
    ubicacion: 'Sucursal Norte',
    departamento: 'Supervisión',
    responsableEmail: 'hovalles@sifygsa.com',
    responsableNombre: 'HERNAN OVALLES GARCIA',
    vencimientoLicencia: '2028-04-10',
    ultimoChecklistFecha: '2026-02-25T10:00:00.000Z',
    ultimoChecklistFolio: 'CHK-AVH-003-002',
    ultimoChecklistDatos: null,
  },
];

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
