import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
 * Convierte un arreglo de puntos (x, y) en una curva Bezier cúbica/cuadrática
 * continua, fluida y con puntas redondeadas para simular caligrafía de pluma ejecutiva.
 */
function pointsToSvgPath(pts: SignatureStrokePoint[]): string {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.5} ${pts[0].y + 0.5}`;
  }
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y}, ${midX} ${midY}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
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
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 360,
    height: 200,
  });

  const currentStrokeRef = useRef<SignatureStrokePoint[]>([]);

  // PanResponder configurado con bloqueo de terminación nativa (evita reinicio de trazo)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // CRÍTICO: Bloquear peticiones del modal o scrollview para cancelar el gesto táctil
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const pt = { x: Math.round(locationX), y: Math.round(locationY) };
        currentStrokeRef.current = [pt];
        setCurrentStroke([pt]);
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = Math.round(locationX);
        const y = Math.round(locationY);
        const pts = currentStrokeRef.current;

        if (pts.length > 0) {
          const last = pts[pts.length - 1];
          // Filtrar temblores microscópicos (<2.5px) para trazos sedosos y alto rendimiento
          const dist = Math.hypot(x - last.x, y - last.y);
          if (dist < 2.5) return;
        }

        currentStrokeRef.current.push({ x, y });
        setCurrentStroke([...currentStrokeRef.current]);
      },

      onPanResponderRelease: () => {
        if (currentStrokeRef.current.length > 0) {
          const finished = [...currentStrokeRef.current];
          setStrokes((prev) => [...prev, finished]);
        }
        currentStrokeRef.current = [];
        setCurrentStroke([]);
      },

      onPanResponderTerminate: () => {
        if (currentStrokeRef.current.length > 0) {
          const finished = [...currentStrokeRef.current];
          setStrokes((prev) => [...prev, finished]);
        }
        currentStrokeRef.current = [];
        setCurrentStroke([]);
      },
    })
  ).current;

  const limpiar = () => {
    currentStrokeRef.current = [];
    setStrokes([]);
    setCurrentStroke([]);
  };

  const guardarFirma = () => {
    const allStrokes = currentStroke.length > 0 ? [...strokes, currentStroke] : strokes;
    if (allStrokes.length === 0) return;

    // Calcular Bounding Box real de la firma para centrado perfecto en PDF
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
      w: canvasSize.width,
      h: canvasSize.height,
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

          {/* Área del Lienzo de Firma */}
          <View
            style={styles.canvasArea}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) {
                setCanvasSize({ width: Math.round(width), height: Math.round(height) });
              }
            }}
          >
            {/* CAPA 1: Renderizado Vectorial Nativo con react-native-svg (pointerEvents="none" para que jamás interfiera con el toque) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%">
                {allStrokes.map((stroke, sIdx) => {
                  if (stroke.length === 0) return null;
                  return (
                    <Path
                      key={`stroke-${sIdx}`}
                      d={pointsToSvgPath(stroke)}
                      stroke="#0f254e"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  );
                })}
              </Svg>
            </View>

            {/* CAPA 2: Mensaje guía si aún no hay trazos */}
            {allStrokes.length === 0 && (
              <View style={styles.placeholderWrap} pointerEvents="none">
                <Ionicons name="pencil" size={26} color="#94a3b8" />
                <Text style={styles.placeholder}>
                  Firma aquí con tu dedo sobre la línea
                </Text>
              </View>
            )}

            {/* CAPA 3: Línea base de firma tipo documento oficial */}
            <View style={styles.signLine} pointerEvents="none">
              <Text style={styles.signLineText}>FIRMA O RÚBRICA</Text>
            </View>

            {/* CAPA 4: SUPERFICIE TÁCTIL DEDICADA Y TRANSPARENTE
                Completamente limpia sin elementos hijos.
                Garantiza que locationX y locationY sean 100% continuos y no salgan hilos extraños. */}
            <View
              style={StyleSheet.absoluteFill}
              collapsable={false}
              {...panResponder.panHandlers}
            />
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
