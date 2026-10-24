export type SiNo = 'SI' | 'NO';

export interface FotoEvidencia {
  id: string;
  fase: string;
  etiqueta: string;
  uriLocal?: string;
  base64?: string;
  url?: string;
}

export interface VehiculoCatalogo {
  consecutivo: string;
  placas: string;
  marca: string;
  modelo: string;
  linea: string;
  color: string;
  numeroSerie: string;
  polizaSeguro: string;
  vencimientoPoliza: string | null;
  vencimientoTarjeta: string | null;
  tieneTarjetaCirculacionDoc: boolean;
  tienePolizaDoc: boolean;
  bimestreVerificacion: string;
  estadoVerificacion: string;
  fechaFinVerificacion: string | null;
  kilometrajeActual: number;
  estatusOperativo: string;
  ubicacion: string;
  departamento: string;
  responsableEmail: string;
  responsableNombre: string;
  vencimientoLicencia: string | null;
  ultimoChecklistFecha: string | null;
  ultimoChecklistFolio: string | null;
  ultimoChecklistDatos?: Partial<ChecklistFormState> | null;
}

export interface EmpleadoCatalogo {
  email: string;
  nombreCompleto: string;
  cargo: string;
  rol: string;
  vencimientoLicencia: string | null;
}

export interface ChecklistFormState {
  idLocal: string;
  folio: string;
  fechaRevision: string;
  consecutivo: string;
  placas: string;
  numeroSerie: string;
  marca: string;
  modelo: string;
  tipo: string;
  color: string;
  polizaSeguro: string;
  vencimientoSeguro: string;
  verificacionVehicular: string;
  kilometraje: string;
  millas: string;
  licenciaManejo: {
    tiene: SiNo;
    fechaVencimiento: string;
  };
  polizaVigente: SiNo;
  observaciones: string[]; // 9 líneas (1 a 9)
  inventario: {
    tapetes: SiNo;
    estereo: SiNo;
    pantalla: SiNo;
    encendedor: SiNo;
    tarjetaCirculacion: SiNo;
    polizaGarantia: SiNo;
    manualPropietario: SiNo;
    dadoSeguridad: SiNo;
  };
  funciona: {
    claxon: SiNo;
    limpiaparabrisas: SiNo;
    clima: SiNo;
    gps: SiNo;
    ventana: SiNo;
    seguros: SiNo;
    espejos: SiNo;
    quemacocos: SiNo;
  };
  condicion: {
    pedalEmbrague: SiNo;
    palancaVelocidades: SiNo;
    frenoMano: SiNo;
    asientos: SiNo;
  };
  alertas: {
    cambiarLlanta: SiNo;
    servicio: SiNo;
    bateria: SiNo;
    motor: SiNo;
    checarLlanta: SiNo;
    frenos: SiNo;
    abs: SiNo;
    bolsas: SiNo;
  };
  luces: string;
  herramientaYDanos: {
    gato: SiNo;
    cable: SiNo;
    senales: SiNo;
    extintor: SiNo;
    embudo: SiNo;
    refaccion: SiNo;
    golpes: SiNo;
    pinturaRayada: SiNo;
    pinturaBrizada: SiNo;
    vidriosRotos: SiNo;
  };
  cofreAbierto: {
    aceiteMotor: string;
    refrigerante: string;
    bandas: string;
    liquidoDH: string;
    liquidoFrenos: string;
    tuboMangueras: string;
    tapaDeposito: string;
  };
  llantas: {
    delanteraDerecha: string;
    traseraDerecha: string;
    delanteraIzquierda: string;
    traseraIzquierda: string;
  };
  responsable: string;
  responsableEmail: string;
  inspector: string;
  inspectorEmail: string;
  firmaResponsableBase64: string | null;
  firmaInspectorBase64: string | null;
  fotos: FotoEvidencia[];
  estadoSync: 'BORRADOR' | 'PENDIENTE_SUBIR' | 'SUBIENDO' | 'SINCRONIZADO' | 'ERROR';
  fechaGuardadoLocal: string;
  pdfUrlRemoto?: string;
  errorSync?: string;
}

export function crearChecklistInicial(vehiculo: VehiculoCatalogo, inspectorNombre = 'HERNAN OVALLES GARCIA'): ChecklistFormState {
  const prev = vehiculo.ultimoChecklistDatos;
  const hoy = new Date().toISOString().slice(0, 10);
  const folio = `CHK-${vehiculo.consecutivo}-${Date.now().toString().slice(-5)}`;

  return {
    idLocal: `${vehiculo.consecutivo}_${Date.now()}`,
    folio,
    fechaRevision: hoy,
    consecutivo: vehiculo.consecutivo,
    placas: vehiculo.placas,
    numeroSerie: vehiculo.numeroSerie,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    tipo: vehiculo.linea || vehiculo.modelo,
    color: vehiculo.color,
    polizaSeguro: vehiculo.polizaSeguro,
    vencimientoSeguro: vehiculo.vencimientoPoliza || '',
    verificacionVehicular: vehiculo.bimestreVerificacion || 'N/A',
    kilometraje: vehiculo.kilometrajeActual ? String(vehiculo.kilometrajeActual) : '',
    millas: '',
    licenciaManejo: {
      tiene: prev?.licenciaManejo?.tiene || 'SI',
      fechaVencimiento: vehiculo.vencimientoLicencia || prev?.licenciaManejo?.fechaVencimiento || '',
    },
    polizaVigente: vehiculo.tienePolizaDoc ? 'SI' : 'NO',
    observaciones: prev?.observaciones?.length === 9 ? [...prev.observaciones] : ['', '', '', '', '', '', '', '', ''],
    inventario: {
      tapetes: prev?.inventario?.tapetes || 'SI',
      estereo: prev?.inventario?.estereo || 'SI',
      pantalla: prev?.inventario?.pantalla || 'SI',
      encendedor: prev?.inventario?.encendedor || 'SI',
      tarjetaCirculacion: vehiculo.tieneTarjetaCirculacionDoc ? 'SI' : (prev?.inventario?.tarjetaCirculacion || 'SI'),
      polizaGarantia: prev?.inventario?.polizaGarantia || 'SI',
      manualPropietario: prev?.inventario?.manualPropietario || 'SI',
      dadoSeguridad: prev?.inventario?.dadoSeguridad || 'SI',
    },
    funciona: {
      claxon: prev?.funciona?.claxon || 'SI',
      limpiaparabrisas: prev?.funciona?.limpiaparabrisas || 'SI',
      clima: prev?.funciona?.clima || 'SI',
      gps: prev?.funciona?.gps || 'SI',
      ventana: prev?.funciona?.ventana || 'SI',
      seguros: prev?.funciona?.seguros || 'SI',
      espejos: prev?.funciona?.espejos || 'SI',
      quemacocos: prev?.funciona?.quemacocos || 'NO',
    },
    condicion: {
      pedalEmbrague: prev?.condicion?.pedalEmbrague || 'SI',
      palancaVelocidades: prev?.condicion?.palancaVelocidades || 'SI',
      frenoMano: prev?.condicion?.frenoMano || 'SI',
      asientos: prev?.condicion?.asientos || 'SI',
    },
    alertas: {
      cambiarLlanta: prev?.alertas?.cambiarLlanta || 'NO',
      servicio: prev?.alertas?.servicio || 'NO',
      bateria: prev?.alertas?.bateria || 'NO',
      motor: prev?.alertas?.motor || 'NO',
      checarLlanta: prev?.alertas?.checarLlanta || 'NO',
      frenos: prev?.alertas?.frenos || 'NO',
      abs: prev?.alertas?.abs || 'NO',
      bolsas: prev?.alertas?.bolsas || 'NO',
    },
    luces: prev?.luces || 'TODAS FUNCIONANDO CORRECTAMENTE',
    herramientaYDanos: {
      gato: prev?.herramientaYDanos?.gato || 'SI',
      cable: prev?.herramientaYDanos?.cable || 'SI',
      senales: prev?.herramientaYDanos?.senales || 'SI',
      extintor: prev?.herramientaYDanos?.extintor || 'SI',
      embudo: prev?.herramientaYDanos?.embudo || 'SI',
      refaccion: prev?.herramientaYDanos?.refaccion || 'SI',
      golpes: prev?.herramientaYDanos?.golpes || 'NO',
      pinturaRayada: prev?.herramientaYDanos?.pinturaRayada || 'NO',
      pinturaBrizada: prev?.herramientaYDanos?.pinturaBrizada || 'NO',
      vidriosRotos: prev?.herramientaYDanos?.vidriosRotos || 'NO',
    },
    cofreAbierto: {
      aceiteMotor: prev?.cofreAbierto?.aceiteMotor || 'BIEN',
      refrigerante: prev?.cofreAbierto?.refrigerante || 'BIEN',
      bandas: prev?.cofreAbierto?.bandas || 'BIEN',
      liquidoDH: prev?.cofreAbierto?.liquidoDH || 'BIEN',
      liquidoFrenos: prev?.cofreAbierto?.liquidoFrenos || 'BIEN',
      tuboMangueras: prev?.cofreAbierto?.tuboMangueras || 'BIEN',
      tapaDeposito: prev?.cofreAbierto?.tapaDeposito || 'BIEN',
    },
    llantas: {
      delanteraDerecha: prev?.llantas?.delanteraDerecha || 'BUENA',
      traseraDerecha: prev?.llantas?.traseraDerecha || 'BUENA',
      delanteraIzquierda: prev?.llantas?.delanteraIzquierda || 'BUENA',
      traseraIzquierda: prev?.llantas?.traseraIzquierda || 'BUENA',
    },
    responsable: vehiculo.responsableNombre || prev?.responsable || '',
    responsableEmail: vehiculo.responsableEmail || '',
    inspector: inspectorNombre,
    inspectorEmail: '',
    firmaResponsableBase64: null,
    firmaInspectorBase64: null,
    fotos: [],
    estadoSync: 'BORRADOR',
    fechaGuardadoLocal: new Date().toISOString(),
  };
}
