import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SignatureStrokePoint {
  x: number;
  y: number;
}

interface Props {
  visible: boolean;
  titulo: string;
  nombrePersona: string;
  onClose: () => void;
  onConfirm: (signatureJson: string) => void;
}

/**
 * Pad de Firma táctil para Android.
 * Guarda las coordenadas de los trazos en formato JSON compacto (~1KB)
 * para que jsPDF en el servidor dibuje las líneas vectoriales directamente en el PDF.
 */
export default function SignaturePadModal({
  visible,
  titulo,
  nombrePersona,
  onClose,
  onConfirm,
}: Props) {
  const [strokes, setStrokes] = useState<SignatureStrokePoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<SignatureStrokePoint[]>([]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setCurrentStroke([{ x: Math.round(locationX), y: Math.round(locationY) }]);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setCurrentStroke((prev) => [
        ...prev,
        { x: Math.round(locationX), y: Math.round(locationY) },
      ]);
    },
    onPanResponderRelease: () => {
      setStrokes((prev) => (currentStroke.length > 0 ? [...prev, currentStroke] : prev));
      setCurrentStroke([]);
    },
  });

  const limpiar = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  const guardarFirma = () => {
    const allStrokes = currentStroke.length > 0 ? [...strokes, currentStroke] : strokes;
    if (allStrokes.length === 0) return;

    const payload = JSON.stringify({
      w: 320,
      h: 180,
      strokes: allStrokes,
    });
    onConfirm(payload);
    onClose();
  };

  const allStrokes = currentStroke.length > 0 ? [...strokes, currentStroke] : strokes;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.title}>{titulo}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                Firmante: {nombrePersona || 'Por definir'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View style={styles.canvasArea} {...panResponder.panHandlers}>
            {allStrokes.length === 0 && (
              <Text style={styles.placeholder}>
                Firma aquí con tu dedo sobre el recuadro blanco
              </Text>
            )}
            {allStrokes.map((stroke, sIdx) =>
              stroke.map((pt, pIdx) => (
                <View
                  key={`${sIdx}_${pIdx}`}
                  style={[
                    styles.dot,
                    {
                      left: pt.x - 2.5,
                      top: pt.y - 2.5,
                    },
                  ]}
                />
              ))
            )}
            <View style={styles.signLine} />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.clearBtn} onPress={limpiar}>
              <Ionicons name="refresh-outline" size={18} color="#cbd5e1" />
              <Text style={styles.clearText}>Limpiar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, allStrokes.length === 0 && styles.saveBtnDisabled]}
              disabled={allStrokes.length === 0}
              onPress={guardarFirma}
            >
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
              <Text style={styles.saveText}>Confirmar Firma</Text>
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
    maxWidth: 480,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#fb923c',
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  canvasArea: {
    height: 180,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  placeholder: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  dot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0f172a',
  },
  signLine: {
    position: 'absolute',
    bottom: 28,
    left: 28,
    right: 28,
    height: 1,
    backgroundColor: '#cbd5e1',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
  },
  clearText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 13,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#ea580c',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
