import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  titulo: string;
  subtitulo?: string;
  fechaActualISO?: string; // Formato YYYY-MM-DD
  onClose: () => void;
  onSelectDate: (fechaISO: string) => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function DatePickerModal({
  visible,
  titulo,
  subtitulo,
  fechaActualISO,
  onClose,
  onSelectDate,
}: Props) {
  // Inicializar fecha
  const fechaBase = useMemo(() => {
    if (fechaActualISO && /^\d{4}-\d{2}-\d{2}$/.test(fechaActualISO)) {
      const [y, m, d] = fechaActualISO.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [fechaActualISO]);

  const [anio, setAnio] = useState<number>(fechaBase.getFullYear());
  const [mes, setMes] = useState<number>(fechaBase.getMonth()); // 0-11
  const [diaSeleccionado, setDiaSeleccionado] = useState<number>(fechaBase.getDate());
  const [vistaAnios, setVistaAnios] = useState(false);

  // Generar lista de años (desde 2020 hasta 2035)
  const listaAnios = useMemo(() => {
    const arr = [];
    for (let y = 2020; y <= 2035; y++) arr.push(y);
    return arr;
  }, []);

  // Calcular días del mes actual
  const { diasEnMes, primerDiaSemana } = useMemo(() => {
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    const primerDia = new Date(anio, mes, 1).getDay();
    return { diasEnMes: ultimoDia, primerDiaSemana: primerDia };
  }, [anio, mes]);

  const cambiarMes = (delta: number) => {
    let nuevoMes = mes + delta;
    let nuevoAnio = anio;
    if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAnio += 1;
    } else if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAnio -= 1;
    }
    setMes(nuevoMes);
    setAnio(nuevoAnio);
    const maxDias = new Date(nuevoAnio, nuevoMes + 1, 0).getDate();
    if (diaSeleccionado > maxDias) setDiaSeleccionado(maxDias);
  };

  const aplicarAtajo = (aniosSumar: number) => {
    const hoy = new Date();
    const targetAnio = hoy.getFullYear() + aniosSumar;
    setAnio(targetAnio);
    setMes(hoy.getMonth());
    setDiaSeleccionado(hoy.getDate());
  };

  const confirmar = () => {
    const mm = String(mes + 1).padStart(2, '0');
    const dd = String(diaSeleccionado).padStart(2, '0');
    const fechaFinal = `${anio}-${mm}-${dd}`;
    onSelectDate(fechaFinal);
    onClose();
  };

  // Texto amigable de la fecha actual
  const fechaTextoLegible = useMemo(() => {
    const d = new Date(anio, mes, diaSeleccionado);
    return `${diaSeleccionado} de ${MESES[mes]} de ${anio}`;
  }, [anio, mes, diaSeleccionado]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.title}>{titulo}</Text>
              {subtitulo ? <Text style={styles.subTitle}>{subtitulo}</Text> : null}
              <View style={styles.selectedPill}>
                <Ionicons name="calendar" size={16} color="#fb923c" />
                <Text style={styles.selectedPillText}>{fechaTextoLegible}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Atajos rápidos para vigilantes (Super fáciles de usar) */}
          <View style={styles.shortcutsWrap}>
            <Text style={styles.shortcutsLabel}>Atajos rápidos:</Text>
            <View style={styles.shortcutsRow}>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => aplicarAtajo(1)}
              >
                <Text style={styles.shortcutText}>+1 Año</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => aplicarAtajo(2)}
              >
                <Text style={styles.shortcutText}>+2 Años</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={() => aplicarAtajo(3)}
              >
                <Text style={styles.shortcutText}>+3 Años</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shortcutBtn, { backgroundColor: '#334155' }]}
                onPress={() => aplicarAtajo(0)}
              >
                <Text style={styles.shortcutText}>Hoy</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Selector de Mes y Año */}
          <View style={styles.monthSelectorRow}>
            <TouchableOpacity style={styles.navArrowBtn} onPress={() => cambiarMes(-1)}>
              <Ionicons name="chevron-back" size={22} color="#f8fafc" />
            </TouchableOpacity>

            <View style={styles.monthYearDisplay}>
              <Text style={styles.monthText}>{MESES[mes]}</Text>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => setVistaAnios(!vistaAnios)}
              >
                <Text style={styles.yearText}>{anio}</Text>
                <Ionicons
                  name={vistaAnios ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#fb923c"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.navArrowBtn} onPress={() => cambiarMes(1)}>
              <Ionicons name="chevron-forward" size={22} color="#f8fafc" />
            </TouchableOpacity>
          </View>

          {/* Selector de Años en Rejilla */}
          {vistaAnios ? (
            <ScrollView style={styles.yearsScroll} contentContainerStyle={styles.yearsGrid}>
              {listaAnios.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearItem, y === anio && styles.yearItemActive]}
                  onPress={() => {
                    setAnio(y);
                    setVistaAnios(false);
                  }}
                >
                  <Text style={[styles.yearItemText, y === anio && styles.yearItemTextActive]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            /* Rejilla del Calendario */
            <View style={styles.calendarContainer}>
              {/* Encabezado de Días */}
              <View style={styles.weekRow}>
                {DIAS_SEMANA.map((d) => (
                  <Text key={d} style={styles.weekDayText}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Días del Mes */}
              <View style={styles.daysGrid}>
                {Array.from({ length: primerDiaSemana }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.emptyDayCell} />
                ))}

                {Array.from({ length: diasEnMes }).map((_, i) => {
                  const diaNum = i + 1;
                  const isSelected = diaNum === diaSeleccionado;
                  return (
                    <TouchableOpacity
                      key={`day-${diaNum}`}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                      onPress={() => setDiaSeleccionado(diaNum)}
                    >
                      <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>
                        {diaNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Botones de Acción */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={confirmar}>
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
              <Text style={styles.confirmBtnText}>Confirmar Fecha</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
  },
  subTitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  selectedPillText: {
    color: '#fb923c',
    fontSize: 13,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  shortcutsWrap: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shortcutsLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shortcutBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  shortcutText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  monthSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 10,
  },
  navArrowBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  monthYearDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  yearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fb923c',
  },
  yearText: {
    color: '#fb923c',
    fontSize: 15,
    fontWeight: '800',
  },
  yearsScroll: {
    maxHeight: 220,
  },
  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  yearItem: {
    width: '28%',
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  yearItemActive: {
    backgroundColor: '#fb923c',
    borderColor: '#fb923c',
  },
  yearItemText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  yearItemTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  calendarContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 6,
  },
  weekDayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDayCell: {
    width: `${100 / 7}%`,
    height: 38,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  dayCellSelected: {
    backgroundColor: '#fb923c',
  },
  dayCellText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  dayCellTextSelected: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#fb923c',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#fb923c',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
