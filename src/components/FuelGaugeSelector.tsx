import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type NivelCombustible = 'VACIO' | '1/4' | '1/2' | '3/4' | 'LLENO';

interface Props {
  value: NivelCombustible;
  onChange: (val: NivelCombustible) => void;
  onTomarFotoMarcador?: () => void;
}

const OPCIONES: Array<{
  id: NivelCombustible;
  label: string;
  fraccion: string;
  color: string;
  porcentaje: number;
}> = [
  { id: 'VACIO', label: 'Reserva', fraccion: 'E', color: '#ef4444', porcentaje: 8 },
  { id: '1/4', label: '1/4', fraccion: '1/4', color: '#f97316', porcentaje: 25 },
  { id: '1/2', label: '1/2', fraccion: '1/2', color: '#eab308', porcentaje: 50 },
  { id: '3/4', label: '3/4', fraccion: '3/4', color: '#84cc16', porcentaje: 75 },
  { id: 'LLENO', label: 'Lleno', fraccion: 'F', color: '#10b981', porcentaje: 100 },
];

export default function FuelGaugeSelector({
  value = '1/2',
  onChange,
  onTomarFotoMarcador,
}: Props) {
  const opcionActual = OPCIONES.find((o) => o.id === value) || OPCIONES[2];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="speedometer" size={20} color={opcionActual.color} />
          <Text style={styles.title}>Medidor de Gasolina / Combustible</Text>
        </View>

        <View style={[styles.statusBadge, { borderColor: opcionActual.color }]}>
          <Text style={[styles.statusBadgeText, { color: opcionActual.color }]}>
            {opcionActual.label.toUpperCase()} ({opcionActual.fraccion})
          </Text>
        </View>
      </View>

      {/* Barra Gráfica del Medidor */}
      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeTrack}>
          <View
            style={[
              styles.gaugeFill,
              {
                width: `${opcionActual.porcentaje}%`,
                backgroundColor: opcionActual.color,
              },
            ]}
          />
        </View>

        <View style={styles.gaugeLabels}>
          <Text style={[styles.gaugeMark, value === 'VACIO' && { color: '#ef4444', fontWeight: '900' }]}>
            E (Vacío)
          </Text>
          <Text style={[styles.gaugeMark, value === '1/2' && { color: '#eab308', fontWeight: '900' }]}>
            1/2
          </Text>
          <Text style={[styles.gaugeMark, value === 'LLENO' && { color: '#10b981', fontWeight: '900' }]}>
            F (Lleno)
          </Text>
        </View>
      </View>

      {/* Botones Grandes de Selección */}
      <View style={styles.optionsGrid}>
        {OPCIONES.map((opt) => {
          const isSelected = opt.id === value;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.optionBtn,
                isSelected && {
                  backgroundColor: `${opt.color}25`,
                  borderColor: opt.color,
                  borderWidth: 2,
                },
              ]}
              onPress={() => onChange(opt.id)}
            >
              <Text
                style={[
                  styles.optionFraccion,
                  isSelected && { color: opt.color, fontWeight: '900' },
                ]}
              >
                {opt.fraccion}
              </Text>
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && { color: '#ffffff', fontWeight: '800' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Botón Opcional para Tomar Evidencia del Marcador */}
      {onTomarFotoMarcador && (
        <TouchableOpacity style={styles.photoHintBtn} onPress={onTomarFotoMarcador}>
          <Ionicons name="camera" size={16} color="#38bdf8" />
          <Text style={styles.photoHintText}>Tomar Foto del Marcador de Gasolina</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gaugeContainer: {
    marginBottom: 14,
  },
  gaugeTrack: {
    height: 12,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 6,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  gaugeMark: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  optionBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionFraccion: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
  },
  optionLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  photoHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  photoHintText: {
    color: '#38bdf8',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
