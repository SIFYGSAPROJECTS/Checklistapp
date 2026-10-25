import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import {
  ChecklistFormState,
  VehiculoCatalogo,
  SiNo,
  crearChecklistInicial,
} from './src/types/checklist';
import { evaluarFechaVigencia, DiagnosticoVigencia } from './src/utils/vigencias';
import {
  obtenerCatalogoLocal,
  sincronizarCatalogoDesdeServidor,
  obtenerColaChecklists,
  guardarChecklistEnColaLocal,
  eliminarChecklistLocal,
  sincronizarPendientesConServidor,
  obtenerServerUrl,
  guardarServerUrl,
  obtenerInspectorActivo,
  guardarInspectorActivo,
} from './src/services/offlineSync';
import PhasePhotoEvidence from './src/components/PhasePhotoEvidence';
import SignaturePadModal from './src/components/SignaturePadModal';
import DatePickerModal from './src/components/DatePickerModal';
import FuelGaugeSelector, { NivelCombustible } from './src/components/FuelGaugeSelector';

const FASES = [
  { num: 0, titulo: 'Unidad y Vigencias', corto: 'Unidad', icono: 'car-sport' as const },
  { num: 1, titulo: 'Inventario y Herramienta', corto: 'Inventario', icono: 'briefcase' as const },
  { num: 2, titulo: 'Interior y Testigos', corto: 'Tablero', icono: 'speedometer' as const },
  { num: 3, titulo: 'Cofre y Llantas', corto: 'Motor/Llantas', icono: 'construct' as const },
  { num: 4, titulo: 'Exterior y Observaciones', corto: 'Exterior', icono: 'camera' as const },
  { num: 5, titulo: 'Firmas y Guardado', corto: 'Firmas', icono: 'create' as const },
];

export default function App() {
  const [vista, setVista] = useState<'HOME' | 'WIZARD' | 'SETTINGS'>('HOME');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [vehiculos, setVehiculos] = useState<VehiculoCatalogo[]>([]);
  const [colaLocal, setColaLocal] = useState<ChecklistFormState[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRapido, setFiltroRapido] = useState<'TODOS' | 'ALERTA_SEGURO' | 'AVH' | 'FYG'>('TODOS');
  const [busquedaWizard, setBusquedaWizard] = useState('');
  const [mostrarBuscadorWizard, setMostrarBuscadorWizard] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string>('');
  const [sincronizando, setSincronizando] = useState(false);

  // Configuración
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [inspectorInput, setInspectorInput] = useState('HERNAN OVALLES GARCIA');

  // Estado del Wizard activo
  const [faseActual, setFaseActual] = useState<number>(0);
  const [form, setForm] = useState<ChecklistFormState | null>(null);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoCatalogo | null>(null);

  // Modal de firmas
  const [modalFirmaTipo, setModalFirmaTipo] = useState<'RESPONSABLE' | 'INSPECTOR' | null>(null);
  const [datePickerState, setDatePickerState] = useState<{
    visible: boolean;
    field: 'SEGURO' | 'LICENCIA';
    titulo: string;
    subtitulo: string;
    currentDate: string;
  }>({
    visible: false,
    field: 'SEGURO',
    titulo: '',
    subtitulo: '',
    currentDate: '',
  });

  // 1. Cargar datos locales al iniciar y escuchar cambios de conectividad (Auto-Sync Offline -> Online)
  useEffect(() => {
    inicializarApp();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const conectado = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(conectado);
      if (conectado) {
        ejecutarAutoSync();
      }
    });

    return () => unsubscribe();
  }, []);

  const inicializarApp = async () => {
    const url = await obtenerServerUrl();
    const insp = await obtenerInspectorActivo();
    setServerUrlInput(url);
    setInspectorInput(insp);

    const localCat = await obtenerCatalogoLocal();
    setVehiculos(localCat.vehiculos);

    const cola = await obtenerColaChecklists();
    setColaLocal(cola);

    // Intentar actualizar catálogo desde Easypanel en segundo plano
    const resCat = await sincronizarCatalogoDesdeServidor();
    setVehiculos(resCat.vehiculos);
    setSyncMsg(resCat.mensaje);

    // Sincronizar automáticamente cualquier checklist pendiente en cola al iniciar
    await ejecutarAutoSync();
  };

  const ejecutarAutoSync = async () => {
    const cola = await obtenerColaChecklists();
    const hayPendientes = cola.some((c) => c.estadoSync === 'PENDIENTE_SUBIR');
    if (!hayPendientes) return;

    setSincronizando(true);
    const res = await sincronizarPendientesConServidor(
      (msg) => setSyncMsg(msg),
      (colaParcial) => setColaLocal(colaParcial)
    );
    const nuevaCola = await obtenerColaChecklists();
    setColaLocal(nuevaCola);
    setSincronizando(false);

    if (res.subidos > 0) {
      setSyncMsg(`✅ ${res.subidos} checklist(s) subidos automáticamente a MinIO y PostgreSQL`);
    } else if (res.pendientes > 0) {
      setSyncMsg(`⏳ ${res.pendientes} checklist(s) en cola pendientes de sincronizar`);
    }
  };

  const handleManualSync = async () => {
    setSincronizando(true);
    setSyncMsg('Sincronizando catálogo y checklists pendientes con Easypanel...');
    const cat = await sincronizarCatalogoDesdeServidor();
    setVehiculos(cat.vehiculos);
    const syncRes = await sincronizarPendientesConServidor(
      (m) => setSyncMsg(m),
      (colaParcial) => setColaLocal(colaParcial)
    );
    const nuevaCola = await obtenerColaChecklists();
    setColaLocal(nuevaCola);
    setSincronizando(false);

    if (syncRes.subidos > 0) {
      Alert.alert(
        'Sincronización Exitosa',
        `Se subieron ${syncRes.subidos} checklist(s) con sus fotos y PDF a MinIO.`
      );
    } else {
      setSyncMsg(cat.mensaje);
    }
  };

  // Filtrado de unidades por Consecutivo (AVH-002), Placas (YLN-733-A), Marca, Serie o Responsable + Filtros Rápidos
  const vehiculosFiltrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return vehiculos.filter((v) => {
      if (filtroRapido === 'AVH' && !v.consecutivo.toUpperCase().startsWith('AVH')) return false;
      if (filtroRapido === 'FYG' && !v.consecutivo.toUpperCase().startsWith('F')) return false;
      if (filtroRapido === 'ALERTA_SEGURO') {
        const diag = evaluarFechaVigencia('Póliza', v.polizaSeguro, v.vencimientoPoliza);
        if (diag.nivel !== 'EXPIRED' && diag.nivel !== 'WARNING') return false;
      }
      if (!q) return true;
      return (
        v.consecutivo.toUpperCase().includes(q) ||
        v.placas.toUpperCase().includes(q) ||
        v.marca.toUpperCase().includes(q) ||
        v.linea.toUpperCase().includes(q) ||
        (v.numeroSerie || '').toUpperCase().includes(q) ||
        (v.responsableNombre || '').toUpperCase().includes(q)
      );
    });
  }, [vehiculos, busqueda, filtroRapido]);

  const sugerenciasWizard = useMemo(() => {
    const q = busquedaWizard.trim().toUpperCase();
    if (!q) return vehiculos.slice(0, 6);
    return vehiculos
      .filter(
        (v) =>
          v.consecutivo.toUpperCase().includes(q) ||
          v.placas.toUpperCase().includes(q) ||
          v.marca.toUpperCase().includes(q) ||
          v.linea.toUpperCase().includes(q) ||
          (v.responsableNombre || '').toUpperCase().includes(q)
      )
      .slice(0, 8);
  }, [vehiculos, busquedaWizard]);

  const iniciarChecklistParaVehiculo = (v: VehiculoCatalogo) => {
    const nuevo = crearChecklistInicial(v, inspectorInput);
    setVehiculoSeleccionado(v);
    setForm(nuevo);
    setBusquedaWizard('');
    setMostrarBuscadorWizard(false);
    setFaseActual(0);
    setVista('WIZARD');
  };

  const reabrirChecklistDeCola = (item: ChecklistFormState) => {
    const v = vehiculos.find((x) => x.consecutivo === item.consecutivo) || null;
    setVehiculoSeleccionado(v);
    setForm(item);
    setFaseActual(0);
    setVista('WIZARD');
  };

  const preguardarBorrador = async () => {
    if (!form) return;
    const borrador: ChecklistFormState = {
      ...form,
      estadoSync: form.estadoSync === 'SINCRONIZADO' ? 'PENDIENTE_SUBIR' : 'BORRADOR',
    };
    const nuevaCola = await guardarChecklistEnColaLocal(borrador);
    setColaLocal(nuevaCola);
    Alert.alert(
      'Pre-guardado en Tablet',
      `El avance de la unidad ${form.consecutivo} se guardó en la memoria interna. Puedes continuar después aunque no tengas internet.`
    );
  };

  const finalizarYGuardarChecklist = async () => {
    if (!form) return;

    const kmNum = parseInt(form.kilometraje.replace(/\D/g, ''), 10);
    const kmAnt = vehiculoSeleccionado?.kilometrajeActual || 0;

    if (!form.kilometraje.trim() || isNaN(kmNum) || kmNum <= 0) {
      Alert.alert(
        'Falta Kilometraje',
        'Por favor ingresa los dígitos del odómetro actual en la Fase 3 (Tablero).'
      );
      setFaseActual(2);
      return;
    }

    if (kmAnt > 0 && kmNum < kmAnt) {
      Alert.alert(
        'Kilometraje Inválido',
        `El kilometraje ingresado (${kmNum.toLocaleString()} km) no puede ser menor al último registrado en la unidad (${kmAnt.toLocaleString()} km). Por favor rectifica el odómetro en el tablero.`
      );
      setFaseActual(2);
      return;
    }

    const listoParaSubir: ChecklistFormState = {
      ...form,
      estadoSync: 'PENDIENTE_SUBIR',
    };

    const nuevaCola = await guardarChecklistEnColaLocal(listoParaSubir);
    setColaLocal(nuevaCola);

    // Actualizar catálogo local en memoria
    const localCat = await obtenerCatalogoLocal();
    setVehiculos(localCat.vehiculos);

    if (isOnline) {
      setSincronizando(true);
      setSyncMsg(`Subiendo fotos y generando PDF oficial de ${form.consecutivo}...`);
      const res = await sincronizarPendientesConServidor((m) => setSyncMsg(m));
      const colaPost = await obtenerColaChecklists();
      setColaLocal(colaPost);
      setSincronizando(false);

      if (res.subidos > 0) {
        Alert.alert(
          '¡Checklist Subido a Easypanel!',
          `Las evidencias fotográficas y el PDF oficial de ${form.consecutivo} ya están disponibles en SIFYGSAFLEET.`
        );
      } else {
        Alert.alert(
          'Pre-guardado (Cola Automática)',
          `El checklist de ${form.consecutivo} quedó guardado en la tablet y se subirá solo en cuanto el servidor responda.`
        );
      }
    } else {
      Alert.alert(
        'Pre-guardado Modo Offline',
        `No hay internet en este momento. El checklist de ${form.consecutivo} y sus ${form.fotos.length} fotos quedaron asegurados en la tablet y se subirán solos al recuperar conexión.`
      );
    }

    setVista('HOME');
  };

  // Semáforo de vigencias para la unidad seleccionada
  const diagnosticosVigencia = useMemo<DiagnosticoVigencia[]>(() => {
    if (!form) return [];
    return [
      evaluarFechaVigencia(
        'Póliza de Seguro',
        form.polizaSeguro || 'Sin póliza',
        form.vencimientoSeguro,
        30
      ),
      evaluarFechaVigencia(
        'Licencia del Conductor',
        form.responsable || 'Conductor asignado',
        form.licenciaManejo.fechaVencimiento,
        30
      ),
      evaluarFechaVigencia(
        'Verificación / Engomado',
        `Bimestre: ${form.verificacionVehicular}`,
        vehiculoSeleccionado?.fechaFinVerificacion || null,
        30
      ),
    ];
  }, [form, vehiculoSeleccionado]);

  const pendientesCount = colaLocal.filter((c) => c.estadoSync === 'PENDIENTE_SUBIR').length;

  // ============================================================================
  // RENDERIZADO DE CONTROLES RÁPIDOS DE TABLET (ESTILO NISSAN)
  // ============================================================================
  const renderSiNoRow = (
    label: string,
    value: SiNo,
    onChange: (val: SiNo) => void,
    invertirAlerta = false
  ) => {
    const isSiGood = !invertirAlerta;
    return (
      <View style={styles.checkRow} key={label}>
        <Text style={styles.checkLabel}>{label}</Text>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              value === 'SI' && (isSiGood ? styles.toggleBtnGood : styles.toggleBtnBad),
            ]}
            onPress={() => onChange('SI')}
          >
            <Text style={[styles.toggleBtnText, value === 'SI' && styles.toggleBtnTextActive]}>
              SÍ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              value === 'NO' && (!isSiGood ? styles.toggleBtnGood : styles.toggleBtnBad),
            ]}
            onPress={() => onChange('NO')}
          >
            <Text style={[styles.toggleBtnText, value === 'NO' && styles.toggleBtnTextActive]}>
              NO
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMultiOptionRow = (
    label: string,
    options: string[],
    currentValue: string,
    onSelect: (val: string) => void
  ) => (
    <View style={styles.multiRow} key={label}>
      <Text style={styles.checkLabel}>{label}</Text>
      <View style={styles.chipsWrap}>
        {options.map((opt) => {
          const active = currentValue === opt;
          const isBad = /MAL|FUGA|BAJO|DESGASTADA|CAMBIAR|FALTA/i.test(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.optionChip,
                active && (isBad ? styles.toggleBtnBad : styles.toggleBtnGood),
              ]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.optionChipText, active && styles.toggleBtnTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ============================================================================
  // VISTA CONFIGURACIÓN DE SERVIDOR EASYPANEL
  // ============================================================================
  if (vista === 'SETTINGS') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setVista('HOME')}>
            <Ionicons name="arrow-back" size={22} color="#f8fafc" />
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Conexión con Servidor SIFYGSAFLEET</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>URL del Servidor en Easypanel o Red Local</Text>
            <Text style={styles.helperText}>
              Ingresa el dominio de tu proyecto SIFYGSAFLEET (ej. https://cloud.sifygsa.com o la IP local de tu servidor http://192.168.1.XX:3000 para pruebas):
            </Text>
            <TextInput
              style={styles.input}
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              placeholder="https://cloud.sifygsa.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
              Nombre del Inspector por Defecto (REVISA)
            </Text>
            <TextInput
              style={styles.input}
              value={inspectorInput}
              onChangeText={setInspectorInput}
              placeholder="HERNAN OVALLES GARCIA"
              placeholderTextColor="#64748b"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 20 }]}
              onPress={async () => {
                await guardarServerUrl(serverUrlInput);
                await guardarInspectorActivo(inspectorInput);
                await handleManualSync();
                setVista('HOME');
              }}
            >
              <Ionicons name="save-outline" size={20} color="#ffffff" />
              <Text style={styles.primaryBtnText}>Guardar y Probar Sincronización</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // VISTA ASISTENTE POR FASES (ESTILO TABLET NISSAN)
  // ============================================================================
  if (vista === 'WIZARD' && form) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

        {/* Barra Superior Fija */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              Alert.alert(
                'Salir del Checklist',
                '¿Deseas pre-guardar este borrador en la tablet antes de salir?',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Salir sin guardar',
                    style: 'destructive',
                    onPress: () => setVista('HOME'),
                  },
                  {
                    text: 'Pre-guardar Borrador',
                    onPress: async () => {
                      await preguardarBorrador();
                      setVista('HOME');
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="close" size={22} color="#f8fafc" />
            <Text style={styles.backBtnText}>Cerrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.unitHeaderBadge}
            onPress={() => setMostrarBuscadorWizard((prev) => !prev)}
          >
            <Ionicons name="search" size={14} color="#fb923c" />
            <Text style={styles.unitHeaderEco}>{form.consecutivo}</Text>
            <Text style={styles.unitHeaderPlate}>{form.placas}</Text>
            <Ionicons
              name={mostrarBuscadorWizard ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="#94a3b8"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.draftBtn} onPress={preguardarBorrador}>
            <Ionicons name="bookmark-outline" size={16} color="#38bdf8" />
            <Text style={styles.draftBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>

        {/* Barra de Fases Responsiva (6 Botones visibles en cuadrícula 3x2 sin deslizar) */}
        <View style={styles.stepperBar}>
          <View style={styles.stepperGrid}>
            {FASES.map((f) => {
              const active = faseActual === f.num;
              const done = faseActual > f.num;
              return (
                <TouchableOpacity
                  key={f.num}
                  style={[
                    styles.stepTab,
                    active && styles.stepTabActive,
                    done && styles.stepTabDone,
                  ]}
                  onPress={() => setFaseActual(f.num)}
                >
                  <Ionicons
                    name={done ? 'checkmark-circle' : f.icono}
                    size={15}
                    color={active ? '#ffffff' : done ? '#10b981' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.stepTabText,
                      active && styles.stepTabTextActive,
                      done && styles.stepTabTextDone,
                    ]}
                    numberOfLines={1}
                  >
                    {f.num + 1}. {f.corto}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Contenido de la Fase Actual */}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Buscador Rápido Desplegable dentro del Checklist */}
          {(mostrarBuscadorWizard || faseActual === 0) && (
            <View style={styles.wizardSearchCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="search-circle" size={22} color="#fb923c" />
                  <Text style={styles.sectionTitle}>
                    Buscador Rápido de Vehículo (Consecutivo o Placa)
                  </Text>
                </View>
                {mostrarBuscadorWizard && (
                  <TouchableOpacity onPress={() => setMostrarBuscadorWizard(false)}>
                    <Ionicons name="close-circle" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.searchBarActive}>
                <Ionicons name="search" size={20} color="#fb923c" />
                <TextInput
                  style={styles.searchInput}
                  value={busquedaWizard}
                  onChangeText={(t) => {
                    setBusquedaWizard(t);
                    if (!mostrarBuscadorWizard) setMostrarBuscadorWizard(true);
                  }}
                  onFocus={() => setMostrarBuscadorWizard(true)}
                  placeholder="Escribe ej. AVH-004, YLN-733-A, NP300 o conductor..."
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                />
                {busquedaWizard.length > 0 && (
                  <TouchableOpacity onPress={() => setBusquedaWizard('')}>
                    <Ionicons name="close-circle" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {(mostrarBuscadorWizard || busquedaWizard.trim().length > 0) && (
                <View style={styles.autocompleteList}>
                  {sugerenciasWizard.map((u) => {
                    const isCurrent = u.consecutivo === form.consecutivo;
                    return (
                      <TouchableOpacity
                        key={u.consecutivo}
                        style={[
                          styles.autocompleteItem,
                          isCurrent && styles.autocompleteItemActive,
                        ]}
                        onPress={() => iniciarChecklistParaVehiculo(u)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.autocompleteEco}>
                            🚗 {u.consecutivo} • {u.placas}
                          </Text>
                          <Text style={styles.autocompleteSub} numberOfLines={1}>
                            {u.marca} {u.linea} ({u.modelo}) • {u.responsableNombre || 'Sin asignar'}
                          </Text>
                        </View>
                        <View style={styles.autocompleteSelectBadge}>
                          <Text style={styles.autocompleteSelectText}>
                            {isCurrent ? 'Seleccionado' : 'Cargar'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ─── FASE 0: DATOS DE SERIE Y SEMÁFORO DE VIGENCIAS ─── */}
          {faseActual === 0 && (
            <View>
              <View style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Datos de Serie Pre-cargados Automáticamente
                  </Text>
                  <View style={styles.pillAuto}>
                    <Ionicons name="flash" size={14} color="#fb923c" />
                    <Text style={styles.pillAutoText}>Autocompletado por Placa/ID</Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>ID / CONSECUTIVO</Text>
                    <Text style={styles.infoValHighlight}>{form.consecutivo}</Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>PLACAS</Text>
                    <Text style={styles.infoValHighlight}>{form.placas}</Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>N° DE SERIE (VIN)</Text>
                    <Text style={styles.infoVal}>{form.numeroSerie || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>MARCA / MODELO / TIPO</Text>
                    <Text style={styles.infoVal}>
                      {form.marca} {form.modelo} ({form.tipo})
                    </Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>COLOR</Text>
                    <Text style={styles.infoVal}>{form.color}</Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>ÚLTIMO KM REGISTRADO</Text>
                    <Text style={styles.infoVal}>
                      {vehiculoSeleccionado?.kilometrajeActual
                        ? `${vehiculoSeleccionado.kilometrajeActual.toLocaleString()} km`
                        : 'Sin registro'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Semáforo de Vigencias (Seguro, Licencia, Engomado) */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  Semáforo de Vigencias (Póliza de Seguro, Engomado y Licencia)
                </Text>
                <Text style={styles.helperText}>
                  Verifica de un vistazo si algún documento está vencido o próximo a vencer:
                </Text>

                {diagnosticosVigencia.map((diag) => {
                  const isExp = diag.nivel === 'EXPIRED';
                  const isWarn = diag.nivel === 'WARNING';
                  const isOk = diag.nivel === 'OK';
                  return (
                    <View
                      key={diag.titulo}
                      style={[
                        styles.alertBanner,
                        isExp && styles.alertBannerExpired,
                        isWarn && styles.alertBannerWarning,
                        isOk && styles.alertBannerOk,
                      ]}
                    >
                      <Ionicons
                        name={
                          isExp
                            ? 'warning'
                            : isWarn
                            ? 'time'
                            : isOk
                            ? 'shield-checkmark'
                            : 'help-circle'
                        }
                        size={26}
                        color={
                          isExp
                            ? '#ef4444'
                            : isWarn
                            ? '#f59e0b'
                            : isOk
                            ? '#10b981'
                            : '#94a3b8'
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertTitle}>
                          {diag.titulo} — {diag.referencia}
                        </Text>
                        <Text
                          style={[
                            styles.alertSub,
                            isExp && { color: '#fca5a5' },
                            isWarn && { color: '#fde68a' },
                            isOk && { color: '#6ee7b7' },
                          ]}
                        >
                          {diag.mensaje}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.twoColInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>N° Póliza de Seguro</Text>
                    <TextInput
                      style={styles.input}
                      value={form.polizaSeguro}
                      onChangeText={(t) => setForm({ ...form, polizaSeguro: t })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Vencimiento Seguro</Text>
                    <TouchableOpacity
                      style={styles.datePickerTrigger}
                      onPress={() =>
                        setDatePickerState({
                          visible: true,
                          field: 'SEGURO',
                          titulo: 'Vencimiento de Póliza de Seguro',
                          subtitulo: `Unidad ${form.consecutivo} (${form.placas})`,
                          currentDate: form.vencimientoSeguro || '',
                        })
                      }
                    >
                      <Ionicons name="calendar" size={18} color="#fb923c" />
                      <Text style={[styles.datePickerTriggerText, !form.vencimientoSeguro && styles.datePickerPlaceholder]}>
                        {form.vencimientoSeguro || 'Elegir en Calendario'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.twoColInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Vencimiento Licencia Conductor</Text>
                    <TouchableOpacity
                      style={styles.datePickerTrigger}
                      onPress={() =>
                        setDatePickerState({
                          visible: true,
                          field: 'LICENCIA',
                          titulo: 'Vencimiento de Licencia de Manejo',
                          subtitulo: `Conductor: ${form.responsable || 'Asignado'}`,
                          currentDate: form.licenciaManejo.fechaVencimiento || '',
                        })
                      }
                    >
                      <Ionicons name="calendar" size={18} color="#fb923c" />
                      <Text style={[styles.datePickerTriggerText, !form.licenciaManejo.fechaVencimiento && styles.datePickerPlaceholder]}>
                        {form.licenciaManejo.fechaVencimiento || 'Elegir en Calendario'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Bimestre Verificación (Engomado)</Text>
                    <TextInput
                      style={styles.input}
                      value={form.verificacionVehicular}
                      onChangeText={(t) => setForm({ ...form, verificacionVehicular: t })}
                    />
                  </View>
                </View>

                {renderSiNoRow(
                  '¿Cuenta con Licencia de Manejo física vigente?',
                  form.licenciaManejo.tiene,
                  (val) =>
                    setForm({
                      ...form,
                      licenciaManejo: { ...form.licenciaManejo, tiene: val },
                    })
                )}
                {renderSiNoRow(
                  '¿Póliza de Seguro impresa/digital en la unidad?',
                  form.polizaVigente,
                  (val) => setForm({ ...form, polizaVigente: val })
                )}
              </View>

              <PhasePhotoEvidence
                fase="Fase 1 - Documentos"
                etiquetasSugeridas={[
                  'Tarjeta de Circulación',
                  'Póliza de Seguro',
                  'Licencia de Manejo',
                ]}
                fotos={form.fotos}
                onAgregarFoto={(f) => setForm({ ...form, fotos: [...form.fotos, f] })}
                onEliminarFoto={(id) =>
                  setForm({ ...form, fotos: form.fotos.filter((x) => x.id !== id) })
                }
              />
            </View>
          )}

          {/* ─── FASE 1: INVENTARIO Y HERRAMIENTA ─── */}
          {faseActual === 1 && (
            <View>
              <View style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Inventario de la Unidad</Text>
                  <TouchableOpacity
                    style={styles.markAllBtn}
                    onPress={() =>
                      setForm({
                        ...form,
                        inventario: {
                          tapetes: 'SI',
                          estereo: 'SI',
                          pantalla: 'SI',
                          encendedor: 'SI',
                          tarjetaCirculacion: 'SI',
                          polizaGarantia: 'SI',
                          manualPropietario: 'SI',
                          dadoSeguridad: 'SI',
                        },
                      })
                    }
                  >
                    <Text style={styles.markAllBtnText}>Marcar Todo SÍ</Text>
                  </TouchableOpacity>
                </View>

                {renderSiNoRow('Tapetes completos', form.inventario.tapetes, (v) =>
                  setForm({ ...form, inventario: { ...form.inventario, tapetes: v } })
                )}
                {renderSiNoRow('Estéreo', form.inventario.estereo, (v) =>
                  setForm({ ...form, inventario: { ...form.inventario, estereo: v } })
                )}
                {renderSiNoRow('Pantalla', form.inventario.pantalla, (v) =>
                  setForm({ ...form, inventario: { ...form.inventario, pantalla: v } })
                )}
                {renderSiNoRow('Encendedor', form.inventario.encendedor, (v) =>
                  setForm({ ...form, inventario: { ...form.inventario, encendedor: v } })
                )}
                {renderSiNoRow(
                  'Tarjeta de Circulación',
                  form.inventario.tarjetaCirculacion,
                  (v) =>
                    setForm({
                      ...form,
                      inventario: { ...form.inventario, tarjetaCirculacion: v },
                    })
                )}
                {renderSiNoRow('Póliza de Garantía', form.inventario.polizaGarantia, (v) =>
                  setForm({ ...form, inventario: { ...form.inventario, polizaGarantia: v } })
                )}
                {renderSiNoRow(
                  'Manual de Propietario',
                  form.inventario.manualPropietario,
                  (v) =>
                    setForm({
                      ...form,
                      inventario: { ...form.inventario, manualPropietario: v },
                    })
                )}
                {renderSiNoRow('Dado de Seguridad', form.inventario.dadoSeguridad, (v) =>
                  setForm({ ...form, inventario: { ...form.inventario, dadoSeguridad: v } })
                )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Herramienta y Equipo de Emergencia</Text>
                {renderSiNoRow('Gato Hidráulico / Mecánico', form.herramientaYDanos.gato, (v) =>
                  setForm({
                    ...form,
                    herramientaYDanos: { ...form.herramientaYDanos, gato: v },
                  })
                )}
                {renderSiNoRow('Cables Pasa Corriente', form.herramientaYDanos.cable, (v) =>
                  setForm({
                    ...form,
                    herramientaYDanos: { ...form.herramientaYDanos, cable: v },
                  })
                )}
                {renderSiNoRow('Señales / Triángulos', form.herramientaYDanos.senales, (v) =>
                  setForm({
                    ...form,
                    herramientaYDanos: { ...form.herramientaYDanos, senales: v },
                  })
                )}
                {renderSiNoRow('Extintor Vigente', form.herramientaYDanos.extintor, (v) =>
                  setForm({
                    ...form,
                    herramientaYDanos: { ...form.herramientaYDanos, extintor: v },
                  })
                )}
                {renderSiNoRow('Embudo', form.herramientaYDanos.embudo, (v) =>
                  setForm({
                    ...form,
                    herramientaYDanos: { ...form.herramientaYDanos, embudo: v },
                  })
                )}
                {renderSiNoRow('Llanta de Refacción', form.herramientaYDanos.refaccion, (v) =>
                  setForm({
                    ...form,
                    herramientaYDanos: { ...form.herramientaYDanos, refaccion: v },
                  })
                )}
              </View>

              <PhasePhotoEvidence
                fase="Fase 2 - Inventario y Cajuela"
                etiquetasSugeridas={[
                  'Cajuela y Llanta Refacción',
                  'Kit de Herramienta y Extintor',
                  'Interior y Tapetes',
                ]}
                fotos={form.fotos}
                onAgregarFoto={(f) => setForm({ ...form, fotos: [...form.fotos, f] })}
                onEliminarFoto={(id) =>
                  setForm({ ...form, fotos: form.fotos.filter((x) => x.id !== id) })
                }
              />
            </View>
          )}

          {/* ─── FASE 2: KILOMETRAJE, FUNCIONAMIENTO, CONDICIÓN Y ALERTAS DE TABLERO ─── */}
          {faseActual === 2 && (
            <View>
              <View style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionTitle}>Odómetro (Kilometraje Actual)</Text>
                  <View style={styles.pillAuto}>
                    <Ionicons name="speedometer" size={14} color="#fb923c" />
                    <Text style={styles.pillAutoText}>
                      Anterior: {vehiculoSeleccionado?.kilometrajeActual ? `${vehiculoSeleccionado.kilometrajeActual.toLocaleString()} km` : 'S/N'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.helperText}>
                  Ingresa los dígitos actuales del odómetro. El sistema comprueba que no sea menor al registrado previamente:
                </Text>

                <View style={styles.kmInputRow}>
                  <View style={{ flex: 1, position: 'relative' }}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.kmInputLarge,
                        Boolean(form.kilometraje.trim().length > 0 && (vehiculoSeleccionado?.kilometrajeActual || 0) > 0 && parseInt(form.kilometraje.replace(/\D/g, ''), 10) < (vehiculoSeleccionado?.kilometrajeActual || 0)) && styles.inputErrorBorder,
                        Boolean(form.kilometraje.trim().length > 0 && parseInt(form.kilometraje.replace(/\D/g, ''), 10) >= (vehiculoSeleccionado?.kilometrajeActual || 0)) && styles.inputSuccessBorder,
                      ]}
                      value={form.kilometraje}
                      keyboardType="number-pad"
                      placeholder={`Ej. ${(vehiculoSeleccionado?.kilometrajeActual || 100000) + 150}`}
                      placeholderTextColor="#64748b"
                      onChangeText={(t) => {
                        const soloNum = t.replace(/\D/g, '');
                        setForm({ ...form, kilometraje: soloNum });
                      }}
                    />
                    {form.kilometraje.length > 0 && (
                      <TouchableOpacity
                        style={styles.kmClearBtn}
                        onPress={() => setForm({ ...form, kilometraje: '' })}
                      >
                        <Ionicons name="close-circle" size={20} color="#94a3b8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.kmQuickAddRow}>
                    <TouchableOpacity
                      style={styles.kmQuickBtn}
                      onPress={() => {
                        const base = vehiculoSeleccionado?.kilometrajeActual || 0;
                        setForm({ ...form, kilometraje: String(base + 100) });
                      }}
                    >
                      <Text style={styles.kmQuickBtnText}>+100 km</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.kmQuickBtn}
                      onPress={() => {
                        const base = vehiculoSeleccionado?.kilometrajeActual || 0;
                        setForm({ ...form, kilometraje: String(base + 500) });
                      }}
                    >
                      <Text style={styles.kmQuickBtnText}>+500 km</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Comprobación de Kilometraje */}
                {Boolean(form.kilometraje.trim().length > 0 && (vehiculoSeleccionado?.kilometrajeActual || 0) > 0 && parseInt(form.kilometraje.replace(/\D/g, ''), 10) < (vehiculoSeleccionado?.kilometrajeActual || 0)) && (
                  <View style={styles.kmErrorBanner}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={styles.kmErrorText}>
                      ⚠️ Error: El kilometraje ingresado ({Number(form.kilometraje).toLocaleString()} km) es menor al último registrado ({vehiculoSeleccionado?.kilometrajeActual?.toLocaleString()} km). No se puede registrar un kilometraje menor.
                    </Text>
                  </View>
                )}

                {Boolean(form.kilometraje.trim().length > 0 && parseInt(form.kilometraje.replace(/\D/g, ''), 10) >= (vehiculoSeleccionado?.kilometrajeActual || 0)) && (
                  <View style={styles.kmSuccessBanner}>
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    <Text style={styles.kmSuccessText}>
                      ✅ Kilometraje comprobado: +{(Number(form.kilometraje) - (vehiculoSeleccionado?.kilometrajeActual || 0)).toLocaleString()} km recorridos.
                    </Text>
                  </View>
                )}
              </View>

              {/* Medidor Gráfico de Gasolina */}
              <FuelGaugeSelector
                value={form.combustible || '1/2'}
                onChange={(val) => setForm({ ...form, combustible: val })}
              />

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Funcionamiento de Cabina</Text>
                {renderSiNoRow('Claxon', form.funciona.claxon, (v) =>
                  setForm({ ...form, funciona: { ...form.funciona, claxon: v } })
                )}
                {renderSiNoRow('Limpiaparabrisas', form.funciona.limpiaparabrisas, (v) =>
                  setForm({ ...form, funciona: { ...form.funciona, limpiaparabrisas: v } })
                )}
                {renderSiNoRow('Clima / Calefactor', form.funciona.clima, (v) =>
                  setForm({ ...form, funciona: { ...form.funciona, clima: v } })
                )}
                {renderSiNoRow('GPS Activo', form.funciona.gps, (v) =>
                  setForm({ ...form, funciona: { ...form.funciona, gps: v } })
                )}
                {renderSiNoRow('Ventanas / Cristales', form.funciona.ventana, (v) =>
                  setForm({ ...form, funciona: { ...form.funciona, ventana: v } })
                )}
                {renderSiNoRow('Seguros Eléctricos/Manuales', form.funciona.seguros, (v) =>
                  setForm({ ...form, funciona: { ...form.funciona, seguros: v } })
                )}
                {renderSiNoRow('Espejos Laterales y Retrovisor', form.funciona.espejos, (v) =>
                  setForm({ ...form, funciona: { ...form.funciona, espejos: v } })
                )}
                {renderSiNoRow('Quemacocos', form.funciona.quemacocos, (v) =>
                  setForm({ ...form, funciona: { ...form.funciona, quemacocos: v } })
                )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Condición Mecánica en Cabina y Luces</Text>
                {renderSiNoRow('Pedal de Embrague / Freno', form.condicion.pedalEmbrague, (v) =>
                  setForm({ ...form, condicion: { ...form.condicion, pedalEmbrague: v } })
                )}
                {renderSiNoRow(
                  'Palanca de Velocidades',
                  form.condicion.palancaVelocidades,
                  (v) =>
                    setForm({
                      ...form,
                      condicion: { ...form.condicion, palancaVelocidades: v },
                    })
                )}
                {renderSiNoRow('Freno de Mano', form.condicion.frenoMano, (v) =>
                  setForm({ ...form, condicion: { ...form.condicion, frenoMano: v } })
                )}
                {renderSiNoRow('Asientos / Vestidura en buen estado', form.condicion.asientos, (v) =>
                  setForm({ ...form, condicion: { ...form.condicion, asientos: v } })
                )}

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                  Inspección de Luces Internas / Externas
                </Text>
                <TextInput
                  style={styles.input}
                  value={form.luces}
                  onChangeText={(t) => setForm({ ...form, luces: t })}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  Testigos / Alertas Encendidas en el Tablero
                </Text>
                <Text style={styles.helperText}>
                  Marca &quot;NO&quot; (verde) si NO tiene la alerta encendida, o &quot;SÍ&quot; (rojo) si presenta aviso de falla:
                </Text>
                {renderSiNoRow(
                  '⚠️ Aviso Cambiar Llanta',
                  form.alertas.cambiarLlanta,
                  (v) => setForm({ ...form, alertas: { ...form.alertas, cambiarLlanta: v } }),
                  true
                )}
                {renderSiNoRow(
                  '🔧 Aviso de Servicio',
                  form.alertas.servicio,
                  (v) => setForm({ ...form, alertas: { ...form.alertas, servicio: v } }),
                  true
                )}
                {renderSiNoRow(
                  '🔋 Aviso Checar Batería',
                  form.alertas.bateria,
                  (v) => setForm({ ...form, alertas: { ...form.alertas, bateria: v } }),
                  true
                )}
                {renderSiNoRow(
                  '🚨 Aviso Checar Motor (Check Engine)',
                  form.alertas.motor,
                  (v) => setForm({ ...form, alertas: { ...form.alertas, motor: v } }),
                  true
                )}
                {renderSiNoRow(
                  '🛞 Aviso Checar Presión Llanta (TPMS)',
                  form.alertas.checarLlanta,
                  (v) => setForm({ ...form, alertas: { ...form.alertas, checarLlanta: v } }),
                  true
                )}
                {renderSiNoRow(
                  '🛑 Aviso Checar Frenos',
                  form.alertas.frenos,
                  (v) => setForm({ ...form, alertas: { ...form.alertas, frenos: v } }),
                  true
                )}
                {renderSiNoRow(
                  '⚙️ Aviso Checar ABS',
                  form.alertas.abs,
                  (v) => setForm({ ...form, alertas: { ...form.alertas, abs: v } }),
                  true
                )}
                {renderSiNoRow(
                  '🎈 Aviso Checar Bolsas de Aire (Airbag)',
                  form.alertas.bolsas,
                  (v) => setForm({ ...form, alertas: { ...form.alertas, bolsas: v } }),
                  true
                )}
              </View>

              <PhasePhotoEvidence
                fase="Fase 3 - Odómetro y Tablero"
                etiquetasSugeridas={[
                  'Odómetro / Kilometraje Encendido',
                  'Tablero de Instrumentos',
                  'Cabina / Vestiduras',
                ]}
                fotos={form.fotos}
                onAgregarFoto={(f) => setForm({ ...form, fotos: [...form.fotos, f] })}
                onEliminarFoto={(id) =>
                  setForm({ ...form, fotos: form.fotos.filter((x) => x.id !== id) })
                }
              />
            </View>
          )}

          {/* ─── FASE 3: REVISIÓN A COFRE ABIERTO Y LLANTAS ─── */}
          {faseActual === 3 && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  Revisión a Cofre Abierto (Niveles / Fugas / Tapones)
                </Text>
                {renderMultiOptionRow(
                  'Aceite de Motor',
                  ['BIEN', 'BAJO', 'FUGA', 'CAMBIO'],
                  form.cofreAbierto.aceiteMotor,
                  (v) =>
                    setForm({
                      ...form,
                      cofreAbierto: { ...form.cofreAbierto, aceiteMotor: v },
                    })
                )}
                {renderMultiOptionRow(
                  'Refrigerante / Anticongelante',
                  ['BIEN', 'BAJO', 'FUGA'],
                  form.cofreAbierto.refrigerante,
                  (v) =>
                    setForm({
                      ...form,
                      cofreAbierto: { ...form.cofreAbierto, refrigerante: v },
                    })
                )}
                {renderMultiOptionRow(
                  'Bandas',
                  ['BIEN', 'DESGASTADA', 'CAMBIAR'],
                  form.cofreAbierto.bandas,
                  (v) =>
                    setForm({
                      ...form,
                      cofreAbierto: { ...form.cofreAbierto, bandas: v },
                    })
                )}
                {renderMultiOptionRow(
                  'Líquido Dirección Hidráulica (D.H.)',
                  ['BIEN', 'BAJO', 'FUGA', 'N/A'],
                  form.cofreAbierto.liquidoDH,
                  (v) =>
                    setForm({
                      ...form,
                      cofreAbierto: { ...form.cofreAbierto, liquidoDH: v },
                    })
                )}
                {renderMultiOptionRow(
                  'Líquido de Frenos',
                  ['BIEN', 'BAJO', 'FUGA'],
                  form.cofreAbierto.liquidoFrenos,
                  (v) =>
                    setForm({
                      ...form,
                      cofreAbierto: { ...form.cofreAbierto, liquidoFrenos: v },
                    })
                )}
                {renderMultiOptionRow(
                  'Tubos y Mangueras',
                  ['BIEN', 'RESECAS', 'FUGA'],
                  form.cofreAbierto.tuboMangueras,
                  (v) =>
                    setForm({
                      ...form,
                      cofreAbierto: { ...form.cofreAbierto, tuboMangueras: v },
                    })
                )}
                {renderMultiOptionRow(
                  'Tapas de Depósito',
                  ['COMPLETAS', 'FALTA TAPA', 'DAÑADA'],
                  form.cofreAbierto.tapaDeposito,
                  (v) =>
                    setForm({
                      ...form,
                      cofreAbierto: { ...form.cofreAbierto, tapaDeposito: v },
                    })
                )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Revisión de las 4 Llantas</Text>
                {renderMultiOptionRow(
                  '🛞 Delantera Derecha',
                  ['BUENA', 'MEDIA VIDA', 'DESGASTADA / CAMBIAR'],
                  form.llantas.delanteraDerecha,
                  (v) =>
                    setForm({ ...form, llantas: { ...form.llantas, delanteraDerecha: v } })
                )}
                {renderMultiOptionRow(
                  '🛞 Trasera Derecha',
                  ['BUENA', 'MEDIA VIDA', 'DESGASTADA / CAMBIAR'],
                  form.llantas.traseraDerecha,
                  (v) => setForm({ ...form, llantas: { ...form.llantas, traseraDerecha: v } })
                )}
                {renderMultiOptionRow(
                  '🛞 Delantera Izquierda',
                  ['BUENA', 'MEDIA VIDA', 'DESGASTADA / CAMBIAR'],
                  form.llantas.delanteraIzquierda,
                  (v) =>
                    setForm({ ...form, llantas: { ...form.llantas, delanteraIzquierda: v } })
                )}
                {renderMultiOptionRow(
                  '🛞 Trasera Izquierda',
                  ['BUENA', 'MEDIA VIDA', 'DESGASTADA / CAMBIAR'],
                  form.llantas.traseraIzquierda,
                  (v) =>
                    setForm({ ...form, llantas: { ...form.llantas, traseraIzquierda: v } })
                )}
              </View>

              <PhasePhotoEvidence
                fase="Fase 4 - Motor y Llantas"
                etiquetasSugeridas={[
                  'Motor a Cofre Abierto',
                  'Batería y Depósitos',
                  'Estado de Llantas',
                ]}
                fotos={form.fotos}
                onAgregarFoto={(f) => setForm({ ...form, fotos: [...form.fotos, f] })}
                onEliminarFoto={(id) =>
                  setForm({ ...form, fotos: form.fotos.filter((x) => x.id !== id) })
                }
              />
            </View>
          )}

          {/* ─── FASE 4: EXTERIOR 360°, DAÑOS Y OBSERVACIONES (1 AL 9) ─── */}
          {faseActual === 4 && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Inspección de Carrocería y Cristales</Text>
                {renderSiNoRow(
                  '¿Presenta Golpes en carrocería?',
                  form.herramientaYDanos.golpes,
                  (v) =>
                    setForm({
                      ...form,
                      herramientaYDanos: { ...form.herramientaYDanos, golpes: v },
                    }),
                  true
                )}
                {renderSiNoRow(
                  '¿Presenta Pintura Rayada?',
                  form.herramientaYDanos.pinturaRayada,
                  (v) =>
                    setForm({
                      ...form,
                      herramientaYDanos: { ...form.herramientaYDanos, pinturaRayada: v },
                    }),
                  true
                )}
                {renderSiNoRow(
                  '¿Presenta Pintura Brizada?',
                  form.herramientaYDanos.pinturaBrizada,
                  (v) =>
                    setForm({
                      ...form,
                      herramientaYDanos: { ...form.herramientaYDanos, pinturaBrizada: v },
                    }),
                  true
                )}
                {renderSiNoRow(
                  '¿Presenta Vidrios Rotos o Estrellados?',
                  form.herramientaYDanos.vidriosRotos,
                  (v) =>
                    setForm({
                      ...form,
                      herramientaYDanos: { ...form.herramientaYDanos, vidriosRotos: v },
                    }),
                  true
                )}
              </View>

              <PhasePhotoEvidence
                fase="Fase 5 - Exterior 360 y Detalles"
                etiquetasSugeridas={[
                  'Frente de Unidad',
                  'Costado Derecho',
                  'Costado Izquierdo',
                  'Parte Trasera',
                  'Detalle de Golpe / Rayón',
                ]}
                fotos={form.fotos}
                onAgregarFoto={(f) => setForm({ ...form, fotos: [...form.fotos, f] })}
                onEliminarFoto={(id) =>
                  setForm({ ...form, fotos: form.fotos.filter((x) => x.id !== id) })
                }
              />

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  Observaciones de la Hoja de Revisión (1 al 9)
                </Text>
                <Text style={styles.helperText}>
                  Anota cualquier detalle puntual que deba aparecer numerado en el formato oficial:
                </Text>
                {form.observaciones.map((obs, idx) => (
                  <View key={idx} style={styles.obsRow}>
                    <Text style={styles.obsIndex}>{idx + 1}.-</Text>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={obs}
                      placeholder={`Observación ${idx + 1} (opcional)`}
                      placeholderTextColor="#64748b"
                      onChangeText={(txt) => {
                        const copia = [...form.observaciones];
                        copia[idx] = txt;
                        setForm({ ...form, observaciones: copia });
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ─── FASE 5: FIRMAS Y GUARDADO OFFLINE / SUBIDA AUTOMÁTICA ─── */}
          {faseActual === 5 && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Responsables y Firmas en Pantalla</Text>

                <View style={styles.twoColInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Nombre del Responsable de la Unidad</Text>
                    <TextInput
                      style={styles.input}
                      value={form.responsable}
                      onChangeText={(t) => setForm({ ...form, responsable: t })}
                      placeholder="Ej. ERWIN GARCIA CARRASCO"
                      placeholderTextColor="#64748b"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Revisa (Inspector)</Text>
                    <TextInput
                      style={styles.input}
                      value={form.inspector}
                      onChangeText={(t) => setForm({ ...form, inspector: t })}
                      placeholder="Ej. HERNAN OVALLES GARCIA"
                      placeholderTextColor="#64748b"
                    />
                  </View>
                </View>

                <View style={styles.signaturesGrid}>
                  <TouchableOpacity
                    style={[
                      styles.sigBox,
                      form.firmaResponsableBase64 && styles.sigBoxSigned,
                    ]}
                    onPress={() => setModalFirmaTipo('RESPONSABLE')}
                  >
                    <Ionicons
                      name={
                        form.firmaResponsableBase64
                          ? 'checkmark-done-circle'
                          : 'pencil-outline'
                      }
                      size={28}
                      color={form.firmaResponsableBase64 ? '#10b981' : '#fb923c'}
                    />
                    <Text style={styles.sigBoxTitle}>Firma del Responsable</Text>
                    <Text style={styles.sigBoxSub}>
                      {form.firmaResponsableBase64
                        ? 'Firma capturada (Toca para volver a firmar)'
                        : `Toca para que firme ${form.responsable || 'el responsable'}`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sigBox, form.firmaInspectorBase64 && styles.sigBoxSigned]}
                    onPress={() => setModalFirmaTipo('INSPECTOR')}
                  >
                    <Ionicons
                      name={
                        form.firmaInspectorBase64
                          ? 'checkmark-done-circle'
                          : 'pencil-outline'
                      }
                      size={28}
                      color={form.firmaInspectorBase64 ? '#10b981' : '#fb923c'}
                    />
                    <Text style={styles.sigBoxTitle}>Firma de Quien Revisa</Text>
                    <Text style={styles.sigBoxSub}>
                      {form.firmaInspectorBase64
                        ? 'Firma capturada (Toca para volver a firmar)'
                        : `Toca para que firme ${form.inspector || 'el inspector'}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Resumen antes de finalizar */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Resumen de Envío a SIFYGSAFLEET</Text>
                <Text style={styles.helperText}>
                  • Unidad: {form.consecutivo} ({form.placas}) — {form.marca} {form.tipo}
                  {'\n'}• Kilometraje registrado: {form.kilometraje || 'Pendiente'} km
                  {'\n'}• Evidencias fotográficas adjuntas: {form.fotos.length} fotos comprimidas
                  {'\n'}• Estado de Red:{' '}
                  {isOnline
                    ? '🟢 Conectado (Se subirá a MinIO y generará el PDF al instante)'
                    : '🟠 Sin Internet (Se pre-guardará en la tablet y se subirá solo al conectar)'}
                </Text>

                <TouchableOpacity
                  style={styles.finishBigBtn}
                  onPress={finalizarYGuardarChecklist}
                >
                  <Ionicons name="cloud-upload" size={24} color="#ffffff" />
                  <Text style={styles.finishBigBtnText}>
                    {isOnline
                      ? 'Finalizar y Subir Checklist a Easypanel'
                      : 'Finalizar y Pre-guardar (Se subirá al tener Internet)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Botones de Navegación entre Fases */}
          <View style={styles.wizardNavRow}>
            {faseActual > 0 ? (
              <TouchableOpacity
                style={styles.navPrevBtn}
                onPress={() => setFaseActual(faseActual - 1)}
              >
                <Ionicons name="arrow-back" size={20} color="#f8fafc" />
                <Text style={styles.navPrevText}>Fase Anterior</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            {faseActual < FASES.length - 1 && (
              <TouchableOpacity
                style={styles.navNextBtn}
                onPress={() => setFaseActual(faseActual + 1)}
              >
                <Text style={styles.navNextText}>
                  Siguiente: {FASES[faseActual + 1].titulo}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <DatePickerModal
        visible={datePickerState.visible}
        titulo={datePickerState.titulo}
        subtitulo={datePickerState.subtitulo}
        fechaActualISO={datePickerState.currentDate}
        onClose={() => setDatePickerState((prev) => ({ ...prev, visible: false }))}
        onSelectDate={(fechaISO) => {
          if (!form) return;
          if (datePickerState.field === 'SEGURO') {
            setForm({ ...form, vencimientoSeguro: fechaISO });
          } else if (datePickerState.field === 'LICENCIA') {
            setForm({
              ...form,
              licenciaManejo: { ...form.licenciaManejo, fechaVencimiento: fechaISO },
            });
          }
        }}
      />
      <SignaturePadModal
          visible={modalFirmaTipo !== null}
          titulo={
            modalFirmaTipo === 'RESPONSABLE'
              ? 'Firma del Responsable de Unidad'
              : 'Firma de Quien Revisa (Inspector)'
          }
          nombrePersona={
            modalFirmaTipo === 'RESPONSABLE' ? form.responsable : form.inspector
          }
          onClose={() => setModalFirmaTipo(null)}
          onConfirm={(sigDataUrl) => {
            if (modalFirmaTipo === 'RESPONSABLE') {
              setForm({ ...form, firmaResponsableBase64: sigDataUrl });
            } else {
              setForm({ ...form, firmaInspectorBase64: sigDataUrl });
            }
          }}
        />
      </SafeAreaView>
    );
  }

  // ============================================================================
  // VISTA PRINCIPAL (HOME: BUSCADOR DE UNIDADES + COLA DE SINCRONIZACIÓN)
  // ============================================================================
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Encabezado Principal Responsivo */}
      <View style={styles.homeHeader}>
        <View style={styles.homeHeaderTitleWrap}>
          <Text style={styles.brandTag}>SIFYGSA FLEET • RECEPCIÓN ACTIVA</Text>
          <Text style={styles.homeTitle}>Checklist Vehicular</Text>
        </View>

        <View style={styles.headerRightActions}>
          <View
            style={[
              styles.connPill,
              isOnline ? styles.connPillOnline : styles.connPillOffline,
            ]}
          >
            <View
              style={[
                styles.connDot,
                { backgroundColor: isOnline ? '#10b981' : '#f59e0b' },
              ]}
            />
            <Text style={styles.connText}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleManualSync}
            disabled={sincronizando}
          >
            <Ionicons name="sync" size={20} color="#38bdf8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setVista('SETTINGS')}
          >
            <Ionicons name="settings-outline" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      </View>

      {syncMsg ? (
        <View style={styles.syncStatusBar}>
          <Ionicons name="information-circle-outline" size={16} color="#38bdf8" />
          <Text style={styles.syncStatusText} numberOfLines={1}>
            {syncMsg}
          </Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* 1. BUSCADOR PRINCIPAL DE VEHÍCULOS (SIEMPRE ARRIBA Y VISIBLE) */}
        <View style={styles.searchCardHighlight}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="search-circle" size={24} color="#fb923c" />
              <Text style={styles.sectionTitle}>
                Buscador de Vehículo ({vehiculosFiltrados.length} de {vehiculos.length})
              </Text>
            </View>
            {busqueda.trim().length > 0 && (
              <TouchableOpacity
                style={styles.clearFilterBadge}
                onPress={() => {
                  setBusqueda('');
                  setFiltroRapido('TODOS');
                }}
              >
                <Text style={styles.clearFilterText}>Ver Todos</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.helperText}>
            Busca por Consecutivo (ej. AVH-004), Placas (YLN107A), Modelo o Conductor y tócalo para autollenar su checklist:
          </Text>

          <View style={styles.searchBarActive}>
            <Ionicons name="search" size={22} color="#fb923c" />
            <TextInput
              style={styles.searchInput}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Escribe AVH-004, YLN-733-A, Figo, NP300..."
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={() => {
                if (vehiculosFiltrados.length === 1) {
                  iniciarChecklistParaVehiculo(vehiculosFiltrados[0]);
                }
              }}
            />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => setBusqueda('')}>
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Chips de Filtro Rápido */}
          <View style={styles.filterChipsRow}>
            {[
              { id: 'TODOS' as const, label: `Todas (${vehiculos.length})` },
              { id: 'AVH' as const, label: 'Unidades AVH' },
              { id: 'FYG' as const, label: 'Unidades F&G' },
              { id: 'ALERTA_SEGURO' as const, label: '⚠️ Seguro Vencido / Por Vencer' },
            ].map((chip) => {
              const active = filtroRapido === chip.id;
              return (
                <TouchableOpacity
                  key={chip.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFiltroRapido(chip.id)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sugerencias rápidas desplegables mientras escribe */}
          {busqueda.trim().length > 0 && (
            <View style={styles.autocompleteList}>
              {vehiculosFiltrados.length === 0 ? (
                <Text style={styles.noResultsText}>
                  No se encontró ninguna unidad con "{busqueda}".
                </Text>
              ) : (
                vehiculosFiltrados.slice(0, 5).map((u) => (
                  <TouchableOpacity
                    key={`sug-${u.consecutivo}`}
                    style={styles.autocompleteItem}
                    onPress={() => iniciarChecklistParaVehiculo(u)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autocompleteEco}>
                        🚗 {u.consecutivo} — Placa: {u.placas}
                      </Text>
                      <Text style={styles.autocompleteSub} numberOfLines={1}>
                        {u.marca} {u.linea} ({u.modelo}) • {u.responsableNombre || 'Sin asignar'}
                      </Text>
                    </View>
                    <View style={styles.autocompleteSelectBadge}>
                      <Text style={styles.autocompleteSelectText}>Abrir Checklist →</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* 2. Cola de Checklists Pre-guardados / Sincronizados */}
        {colaLocal.length > 0 && (
          <View style={styles.queueCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cloud-done-outline" size={20} color="#fb923c" />
                <Text style={styles.sectionTitle}>
                  Bandeja de Sincronización ({colaLocal.length})
                </Text>
              </View>
              {pendientesCount > 0 && (
                <TouchableOpacity style={styles.syncNowBtn} onPress={handleManualSync}>
                  <Text style={styles.syncNowBtnText}>
                    Subir {pendientesCount} Pendiente(s)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {colaLocal.map((item) => {
              const isSynced = item.estadoSync === 'SINCRONIZADO';
              const isDraft = item.estadoSync === 'BORRADOR';
              return (
                <View key={item.idLocal} style={styles.queueRow}>
                  <View style={styles.queueRowTop}>
                    <Text style={styles.queueUnit}>
                      {item.consecutivo} ({item.placas})
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isSynced
                          ? styles.statusSynced
                          : isDraft
                          ? styles.statusDraft
                          : styles.statusPending,
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {isSynced
                          ? 'SUBIDO A MINIO'
                          : isDraft
                          ? 'BORRADOR LOCAL'
                          : 'PENDIENTE SUBIR'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.queueMeta}>
                    Folio: {item.folio} • {item.fotos.length} fotos • Km: {item.kilometraje || 'S/N'}
                  </Text>

                  <View style={styles.queueActionsWrap}>
                    {item.pdfUrlRemoto && (
                      <TouchableOpacity
                        style={styles.queueActionBtn}
                        onPress={() => Linking.openURL(item.pdfUrlRemoto!)}
                      >
                        <Ionicons name="document-text-outline" size={17} color="#10b981" />
                        <Text style={[styles.queueActionText, { color: '#10b981' }]}>Ver PDF Oficial</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.queueActionBtn}
                      onPress={() => reabrirChecklistDeCola(item)}
                    >
                      <Ionicons name="create-outline" size={17} color="#38bdf8" />
                      <Text style={styles.queueActionText}>Abrir</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.queueActionBtn}
                      onPress={async () => {
                        const nueva = await eliminarChecklistLocal(item.idLocal);
                        setColaLocal(nueva);
                      }}
                    >
                      <Ionicons name="trash-outline" size={17} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Tarjetas de Vehículos con Semáforo de Vigencia Integrado */}
        <View style={styles.vehiclesGrid}>
          {vehiculosFiltrados.map((v) => {
            const diagPoliza = evaluarFechaVigencia('Póliza', v.polizaSeguro, v.vencimientoPoliza);
            const diagLic = evaluarFechaVigencia('Licencia', v.responsableNombre, v.vencimientoLicencia);

            return (
              <TouchableOpacity
                key={v.consecutivo}
                style={styles.vehicleCard}
                onPress={() => iniciarChecklistParaVehiculo(v)}
              >
                <View style={styles.vehicleCardTop}>
                  <View style={styles.ecoBadge}>
                    <Ionicons name="car-sport" size={18} color="#fb923c" />
                    <Text style={styles.ecoText}>{v.consecutivo}</Text>
                  </View>
                  <View style={styles.plateBadge}>
                    <Text style={styles.plateText}>{v.placas}</Text>
                  </View>
                </View>

                <Text style={styles.vehicleTitle}>
                  {v.marca} {v.linea} ({v.modelo})
                </Text>
                <Text style={styles.vehicleSub}>
                  Color: {v.color} • Serie: {v.numeroSerie || 'S/N'}
                </Text>
                <Text style={styles.vehicleSub}>
                  Responsable: {v.responsableNombre || 'Sin asignar'} • Km:{' '}
                  {v.kilometrajeActual.toLocaleString()}
                </Text>

                {/* Mini Semáforo de Vigencias en la tarjeta */}
                <View style={styles.miniAlertsWrap}>
                  <View
                    style={[
                      styles.miniAlertPill,
                      diagPoliza.nivel === 'EXPIRED'
                        ? styles.miniExpired
                        : diagPoliza.nivel === 'WARNING'
                        ? styles.miniWarn
                        : styles.miniOk,
                    ]}
                  >
                    <Text style={styles.miniAlertText}>
                      🛡️ Seguro: {diagPoliza.nivel === 'EXPIRED' ? 'VENCIDO' : diagPoliza.fechaVencimiento}
                    </Text>
                  </View>

                  <View style={styles.miniAlertPill}>
                    <Text style={styles.miniAlertText}>
                      🏷️ Engomado: {v.bimestreVerificacion}
                    </Text>
                  </View>

                  {v.vencimientoLicencia && (
                    <View
                      style={[
                        styles.miniAlertPill,
                        diagLic.nivel === 'EXPIRED'
                          ? styles.miniExpired
                          : diagLic.nivel === 'WARNING'
                          ? styles.miniWarn
                          : styles.miniOk,
                      ]}
                    >
                      <Text style={styles.miniAlertText}>
                        🪪 Licencia: {diagLic.fechaVencimiento}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.startChecklistRow}>
                  <Text style={styles.startChecklistText}>
                    Iniciar Revisión por Fases
                  </Text>
                  <Ionicons name="arrow-forward-circle" size={22} color="#fb923c" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#fb923c',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  datePickerTriggerText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  datePickerPlaceholder: {
    color: '#94a3b8',
    fontWeight: 'normal',
  },
  kmInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  kmInputLarge: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 1,
    paddingRight: 36,
  },
  kmClearBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  kmQuickAddRow: {
    flexDirection: 'row',
    gap: 6,
  },
  kmQuickBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
  },
  kmQuickBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
  },
  kmErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  kmErrorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  kmSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  kmSuccessText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  inputErrorBorder: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  inputSuccessBorder: {
    borderColor: '#10b981',
    borderWidth: 2,
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  homeHeaderTitleWrap: {
    flex: 1,
    paddingRight: 6,
  },
  brandTag: {
    color: '#fb923c',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  homeTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  connPillOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
  },
  connPillOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  iconBtn: {
    backgroundColor: '#0f172a',
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  syncStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0c4a6e',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  syncStatusText: {
    color: '#e0f2fe',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 50,
  },
  queueCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#fb923c',
  },
  queueRow: {
    flexDirection: 'column',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  queueRowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  queueActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  queueUnit: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 15,
  },
  queueMeta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusSynced: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusDraft: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  statusPending: {
    backgroundColor: 'rgba(249, 115, 22, 0.25)',
  },
  statusBadgeText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800',
  },
  queueActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  queueActionText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  syncNowBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  syncNowBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  searchCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchCardHighlight: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#fb923c',
  },
  wizardSearchCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#475569',
    gap: 10,
  },
  searchBarActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#fb923c',
    gap: 10,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: '#fb923c',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#fb923c',
  },
  clearFilterBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearFilterText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  autocompleteList: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 8,
  },
  autocompleteItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  autocompleteEco: {
    color: '#f8fafc',
    fontSize: 13.5,
    fontWeight: '800',
  },
  autocompleteSub: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 2,
  },
  autocompleteSelectBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderWidth: 1,
    borderColor: '#fb923c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  autocompleteSelectText: {
    color: '#fb923c',
    fontSize: 11,
    fontWeight: '800',
  },
  noResultsText: {
    color: '#94a3b8',
    fontSize: 13,
    padding: 14,
    textAlign: 'center',
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  vehiclesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  vehicleCard: {
    flexGrow: 1,
    minWidth: 300,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  vehicleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ecoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  ecoText: {
    color: '#fb923c',
    fontSize: 16,
    fontWeight: '900',
  },
  plateBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  plateText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  vehicleTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
  },
  vehicleSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
  },
  miniAlertsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  miniAlertPill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  miniExpired: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  miniWarn: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  miniOk: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  miniAlertText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
  },
  startChecklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  startChecklistText: {
    color: '#fb923c',
    fontSize: 13,
    fontWeight: '800',
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  backBtnText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 12,
  },
  topBarTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  unitHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitHeaderEco: {
    color: '#fb923c',
    fontSize: 16,
    fontWeight: '900',
  },
  unitHeaderPlate: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unitHeaderModel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  draftBtnText: {
    color: '#38bdf8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  stepperBar: {
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  stepperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepTab: {
    width: '31.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepTabActive: {
    backgroundColor: '#ea580c',
    borderColor: '#fb923c',
  },
  stepTabDone: {
    borderColor: '#10b981',
  },
  stepTabText: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '800',
  },
  stepTabTextActive: {
    color: '#ffffff',
  },
  stepTabTextDone: {
    color: '#34d399',
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 17,
  },
  pillAuto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillAutoText: {
    color: '#fb923c',
    fontSize: 11,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  infoBox: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
  },
  infoVal: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  infoValHighlight: {
    color: '#fb923c',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#475569',
  },
  alertBannerExpired: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  alertBannerWarning: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  alertBannerOk: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  alertTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  alertSub: {
    color: '#cbd5e1',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
  twoColInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  fieldLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  kmInput: {
    borderColor: '#fb923c',
    fontSize: 18,
    fontWeight: '900',
    color: '#fb923c',
  },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  checkLabel: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    paddingRight: 10,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
  },
  toggleBtnGood: {
    backgroundColor: '#059669',
    borderColor: '#10b981',
  },
  toggleBtnBad: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
  },
  toggleBtnText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 13,
  },
  toggleBtnTextActive: {
    color: '#ffffff',
  },
  multiRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
  },
  optionChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  markAllBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  markAllBtnText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
  },
  obsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  obsIndex: {
    color: '#fb923c',
    fontWeight: '800',
    width: 26,
  },
  signaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 14,
  },
  sigBox: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#fb923c',
  },
  sigBoxSigned: {
    borderColor: '#10b981',
    borderStyle: 'solid',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  sigBoxTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  sigBoxSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  finishBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ea580c',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 14,
  },
  finishBigBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  wizardNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  navPrevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  navPrevText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 13,
  },
  navNextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  navNextText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
});
