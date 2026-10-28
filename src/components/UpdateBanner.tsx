import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  InfoActualizacionApp,
  descargarEInstalarActualizacion,
} from '../services/appUpdater';

interface Props {
  release: InfoActualizacionApp | null;
  versionInstalada: string;
  onDismiss?: () => void;
}

export default function UpdateBanner({
  release,
  versionInstalada,
  onDismiss,
}: Props) {
  const [descargando, setDescargando] = useState(false);
  const [progresoPct, setProgresoPct] = useState(0);
  const [detalleDescarga, setDetalleDescarga] = useState('');

  if (!release) return null;

  const pesoMB = release.sizeBytes
    ? `${(release.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : '';

  const iniciarActualizacion = async () => {
    if (descargando) return;
    setDescargando(true);
    setProgresoPct(0);
    setDetalleDescarga('Conectando con servidor SIFYGSAFLEET...');

    const res = await descargarEInstalarActualizacion(
      release,
      (pct, descMB, totMB) => {
        setProgresoPct(pct);
        setDetalleDescarga(`${descMB} MB / ${totMB} MB`);
      }
    );

    setDescargando(false);
    if (!res.ok && res.error) {
      Alert.alert('Error al actualizar', res.error);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.88}
        disabled={descargando}
        onPress={iniciarActualizacion}
        style={[
          styles.banner,
          release.obligatoria && styles.bannerPrioritario,
        ]}
      >
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            {descargando ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="rocket" size={18} color="#ffffff" />
            )}
          </View>

          <View style={styles.textBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {descargando
                  ? `Descargando actualización v${release.version}... ${progresoPct}%`
                  : `Nueva versión v${release.version} disponible`}
              </Text>
              {!descargando && pesoMB ? (
                <View style={styles.sizePill}>
                  <Text style={styles.sizePillText}>{pesoMB}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.subtitle} numberOfLines={2}>
              {descargando
                ? `${detalleDescarga} — Tus checklists locales y tu sesión se conservarán intactos.`
                : `Pulsa aquí para actualizar (actual v${versionInstalada})${
                    release.notas ? ` · ${release.notas}` : ''
                  }`}
            </Text>
          </View>

          {!descargando && (
            <View style={styles.ctaBadge}>
              <Ionicons name="download-outline" size={15} color="#0f172a" />
              <Text style={styles.ctaBadgeText}>Actualizar</Text>
            </View>
          )}
        </View>

        {descargando && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progresoPct}%` }]} />
          </View>
        )}
      </TouchableOpacity>

      {!descargando && !release.obligatoria && onDismiss && (
        <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
          <Ionicons name="close" size={16} color="#bae6fd" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    position: 'relative',
  },
  banner: {
    backgroundColor: '#0369a1',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#38bdf8',
    shadowColor: '#0284c7',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  bannerPrioritario: {
    backgroundColor: '#0f766e',
    borderColor: '#2dd4bf',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    paddingRight: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  title: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  sizePill: {
    backgroundColor: 'rgba(15,23,42,0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  sizePillText: {
    color: '#e0f2fe',
    fontSize: 10,
    fontWeight: '700',
  },
  subtitle: {
    color: '#e0f2fe',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  ctaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  ctaBadgeText: {
    color: '#0f172a',
    fontSize: 11.5,
    fontWeight: '800',
  },
  progressTrack: {
    marginTop: 9,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(15,23,42,0.4)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

