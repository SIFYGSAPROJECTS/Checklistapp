import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { FotoEvidencia } from '../types/checklist';

interface Props {
  fase: string;
  etiquetasSugeridas: string[];
  fotos: FotoEvidencia[];
  onAgregarFoto: (foto: FotoEvidencia) => void;
  onEliminarFoto: (id: string) => void;
}

export default function PhasePhotoEvidence({
  fase,
  etiquetasSugeridas,
  fotos,
  onAgregarFoto,
  onEliminarFoto,
}: Props) {
  const fotosDeFase = fotos.filter((f) => f.fase === fase);

  const capturarFoto = async (etiqueta: string, usarGaleria = false) => {
    try {
      if (usarGaleria) {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permiso requerido', 'Activa el permiso de galería para adjuntar fotos.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permiso de cámara', 'Se necesita acceso a la cámara de la tablet para tomar evidencia.');
          return;
        }
      }

      const result = usarGaleria
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      // Comprimir y redimensionar a 850px (50% calidad JPEG -> ~50-75KB por foto)
      // para proteger el disco NVMe de 100GB del servidor Easypanel
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 850 } }],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      const nuevaFoto: FotoEvidencia = {
        id: `${fase}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fase,
        etiqueta,
        uriLocal: manipResult.uri,
        base64: manipResult.base64 ? `data:image/jpeg;base64,${manipResult.base64}` : undefined,
      };

      onAgregarFoto(nuevaFoto);
    } catch (e: any) {
      Alert.alert('Error de cámara', e?.message || 'No se pudo capturar la fotografía.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="camera" size={20} color="#f97316" />
          <Text style={styles.title}>Evidencia Fotográfica — {fase}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{fotosDeFase.length} fotos</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Toca un botón para abrir la cámara de la tablet y capturar la evidencia de esta fase (se comprime y pre-guarda sin internet):
      </Text>

      <View style={styles.buttonsGrid}>
        {etiquetasSugeridas.map((etq) => {
          const yaTomada = fotosDeFase.some((f) => f.etiqueta === etq);
          return (
            <TouchableOpacity
              key={etq}
              style={[styles.captureBtn, yaTomada && styles.captureBtnDone]}
              onPress={() => capturarFoto(etq, false)}
              onLongPress={() => capturarFoto(etq, true)}
            >
              <Ionicons
                name={yaTomada ? 'checkmark-circle' : 'camera-outline'}
                size={20}
                color={yaTomada ? '#10b981' : '#f8fafc'}
              />
              <Text style={[styles.captureBtnText, yaTomada && styles.captureBtnTextDone]}>
                {etq}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.captureBtn, styles.galleryBtn]}
          onPress={() => capturarFoto('Evidencia Adicional', true)}
        >
          <Ionicons name="images-outline" size={19} color="#38bdf8" />
          <Text style={styles.galleryBtnText}>Desde Galería</Text>
        </TouchableOpacity>
      </View>

      {fotosDeFase.length > 0 && (
        <View style={styles.thumbsGrid}>
          {fotosDeFase.map((foto) => (
            <View key={foto.id} style={styles.thumbCard}>
              <Image
                source={{ uri: foto.uriLocal || foto.base64 || foto.url }}
                style={styles.thumbImg}
              />
              <View style={styles.thumbFooter}>
                <Text style={styles.thumbLabel} numberOfLines={1}>
                  {foto.etiqueta}
                </Text>
                <TouchableOpacity onPress={() => onEliminarFoto(foto.id)}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  badgeText: {
    color: '#fb923c',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12,
  },
  buttonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  captureBtnDone: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  captureBtnText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  captureBtnTextDone: {
    color: '#34d399',
  },
  galleryBtn: {
    borderColor: '#0284c7',
  },
  galleryBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  thumbsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  thumbCard: {
    width: 145,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  thumbImg: {
    width: '100%',
    height: 95,
    resizeMode: 'cover',
  },
  thumbFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  thumbLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
});
