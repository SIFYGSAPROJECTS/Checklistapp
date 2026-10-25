import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
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

export default function SignaturePadModal({
  visible,
  titulo,
  nombrePersona,
  onClose,
  onConfirm,
}: Props) {
  const [strokes, setStrokes] = useState<SignatureStrokePoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<SignatureStrokePoint[]>([]);

  // Mantener referencia mutable del stroke actual para evitar pérdida de puntos por re-render
  const currentStrokeRef = useRef<SignatureStrokePoint[]>([]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const pt = { x: Math.round(locationX), y: Math.round(locationY) };
      currentStrokeRef.current = [pt];
      setCurrentStroke([pt]);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const pt = { x: Math.round(locationX), y: Math.round(locationY) };
      currentStrokeRef.current.push(pt);
      setCurrentStroke([...currentStrokeRef.current]);
    },
    onPanResponderRelease: () => {
      if (currentStrokeRef.current.length > 0) {
        setStrokes((prev) => [...prev, currentStrokeRef.current]);
      }
      currentStrokeRef.current = [];
      setCurrentStroke([]);
    },
  });

  const limpiar = () => {
    currentStrokeRef.current = [];
    setStrokes([]);
    setCurrentStroke([]);
  };

  const guardarFirma = () => {
    const allStrokes = currentStroke.length > 0 ? [...strokes, currentStroke] : strokes;
    if (allStrokes.length === 0) return;

    // Calcular Bounding Box real de la firma para centrarla perfectamente en el PDF
    let minX = 9999;
    let maxX = 0;
    let minY = 9999;
    let maxY = 0;

    for (const stroke of allStrokes) {
      for (const pt of stroke) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    }

    const payload = JSON.stringify({
      w: 360,
      h: 200,
      bbox: { minX, maxX, minY, maxY },
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

          {/* Lienzo de Firma con PanResponder */}
          <View style={styles.canvasArea} {...panResponder.panHandlers}>
            {allStrokes.length === 0 && (
              <View style={styles.placeholderWrap} pointerEvents="none">
                <Ionicons name="pencil" size={26} color="#94a3b8" />
                <Text style={styles.placeholder}>
                  Firma aquí con tu dedo sobre la línea
                </Text>
              </View>
            )}

            {/* Renderizado de trazos continuos */}
            {allStrokes.map((stroke, sIdx) => {
              if (stroke.length === 0) return null;
              return (
                <React.Fragment key={`stroke-${sIdx}`}>
                  {stroke.map((pt, pIdx) => {
                    if (pIdx === 0) {
                      return (
                        <View
                          key={`pt-${sIdx}-${pIdx}`}
                          style={[styles.dot, { left: pt.x - 2, top: pt.y - 2 }]}
                        />
                      );
                    }
                    const prevPt = stroke[pIdx - 1];
                    const dx = pt.x - prevPt.x;
                    const dy = pt.y - prevPt.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx);

                    return (
                      <View
                        key={`line-${sIdx}-${pIdx}`}
                        style={[
                          styles.segment,
                          {
                            left: prevPt.x,
                            top: prevPt.y - 1.5,
                            width: distance,
                            transform: [{ rotate: `${angle}rad` }],
                          },
                        ]}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Línea guía de firma tipo documento oficial */}
            <View style={styles.signLine} pointerEvents="none">
              <Text style={styles.signLineText}>FIRMA O RÚBRICA</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.clearBtn} onPress={limpiar}>
              <Ionicons name="refresh-outline" size={18} color="#cbd5e1" />
              <Text style={styles.clearText}>Borrar y Repetir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, allStrokes.length === 0 && styles.saveBtnDisabled]}
              disabled={allStrokes.length === 0}
              onPress={guardarFirma}
            >
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
              <Text style={styles.saveText}>Aceptar Firma</Text>
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
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
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  canvasArea: {
    height: 200,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  placeholderWrap: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  placeholder: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  dot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0f172a',
  },
  segment: {
    position: 'absolute',
    height: 3.5,
    backgroundColor: '#0f172a',
    borderRadius: 2,
    transformOrigin: 'left center',
  },
  signLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    borderBottomWidth: 1.5,
    borderBottomColor: '#94a3b8',
    alignItems: 'center',
  },
  signLineText: {
    position: 'absolute',
    bottom: -16,
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  clearText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fb923c',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnDisabled: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  saveText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
