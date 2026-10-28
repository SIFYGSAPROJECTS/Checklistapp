import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SesionPersistente,
  iniciarSesionCorporativa,
} from '../services/authService';
import { guardarServerUrl } from '../services/offlineSync';
import { InfoActualizacionApp } from '../services/appUpdater';
import UpdateBanner from './UpdateBanner';

interface Props {
  isOnline: boolean;
  initialServerUrl: string;
  initialEmail?: string;
  motivoRelogin?: string | null;
  pendientesEnCola: number;
  versionInstalada: string;
  updateRelease: InfoActualizacionApp | null;
  onLoginSuccess: (sesion: SesionPersistente, serverUrl: string) => void;
}

export default function LoginScreen({
  isOnline,
  initialServerUrl,
  initialEmail = '',
  motivoRelogin,
  pendientesEnCola,
  versionInstalada,
  updateRelease,
  onLoginSuccess,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfigUrl, setMostrarConfigUrl] = useState(false);
  const [serverUrl, setServerUrl] = useState(initialServerUrl || 'https://cloud.sifygsa.com');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Ingresa tu correo corporativo y tu contraseña.');
      return;
    }

    setCargando(true);
    try {
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      if (cleanUrl) {
        await guardarServerUrl(cleanUrl);
      }

      const resultado = await iniciarSesionCorporativa(email, password, cleanUrl);
      if (!resultado.ok || !resultado.sesion) {
        setErrorMsg(resultado.error || 'No se pudo iniciar sesión.');
        return;
      }

      onLoginSuccess(resultado.sesion, cleanUrl);
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <UpdateBanner
        release={updateRelease}
        versionInstalada={versionInstalada}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* Encabezado Corporativo */}
            <View style={styles.logoHeader}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.netBadgeRow}>
                <View
                  style={[
                    styles.netDot,
                    { backgroundColor: isOnline ? '#10b981' : '#f59e0b' },
                  ]}
                />
                <Text style={styles.netText}>
                  {isOnline ? 'Conectado a red' : 'Sin conexión a internet'}
                </Text>
              </View>
              <Text style={styles.title}>SIFYGSA Checklist Vehicular</Text>
              <Text style={styles.subtitle}>
                Inicia sesión con tu cuenta de SIFYGSAFLEET. Tu sesión quedará activa en este dispositivo para trabajar con o sin internet.
              </Text>
            </View>

            {/* Aviso si la sesión previa expiró o fue revocada */}
            {motivoRelogin ? (
              <View style={styles.warningBox}>
                <Ionicons name="shield-outline" size={18} color="#fbbf24" />
                <Text style={styles.warningText}>{motivoRelogin}</Text>
              </View>
            ) : null}

            {/* Aviso tranquilizador si hay checklists guardados en cola */}
            {pendientesEnCola > 0 ? (
              <View style={styles.queueSafeBox}>
                <Ionicons name="cloud-done-outline" size={18} color="#34d399" />
                <Text style={styles.queueSafeText}>
                  Tienes {pendientesEnCola} checklist(s) resguardados en este dispositivo. Se sincronizarán automáticamente al iniciar sesión.
                </Text>
              </View>
            ) : null}

            {!isOnline && (
              <View style={styles.offlineNotice}>
                <Ionicons name="wifi-outline" size={18} color="#38bdf8" />
                <Text style={styles.offlineNoticeText}>
                  Necesitas internet únicamente para validar tu acceso inicial. Una vez dentro, podrás operar 100% en modo Offline.
                </Text>
              </View>
            )}

            {/* Formulario */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CORREO CORPORATIVO</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="usuario@sifygsa.com"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!cargando}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CONTRASEÑA</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!mostrarPassword}
                  autoCapitalize="none"
                  editable={!cargando}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setMostrarPassword((p) => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={mostrarPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#f87171" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.loginBtn, cargando && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={cargando}
            >
              {cargando ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.loginBtnText}>Verificando acceso y descargando catálogo...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#ffffff" />
                  <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Configuración avanzada opcional de servidor */}
            <TouchableOpacity
              style={styles.advToggle}
              onPress={() => setMostrarConfigUrl((p) => !p)}
            >
              <Ionicons
                name={mostrarConfigUrl ? 'chevron-up' : 'server-outline'}
                size={14}
                color="#64748b"
              />
              <Text style={styles.advToggleText}>
                {mostrarConfigUrl ? 'Ocultar servidor' : `Servidor: ${serverUrl}`}
              </Text>
            </TouchableOpacity>

            {mostrarConfigUrl && (
              <View style={styles.advBox}>
                <Text style={styles.label}>URL SERVIDOR SIFYGSAFLEET</Text>
                <TextInput
                  style={styles.advInput}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="https://cloud.sifygsa.com"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <Text style={styles.versionFooter}>
              Versión instalada v{versionInstalada} · Seguridad Cifrada SIFYGSA
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 10,
  },
  netBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  netDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  netText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    color: '#fde68a',
    fontSize: 12,
    lineHeight: 17,
  },
  queueSafeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
  },
  queueSafeText: {
    flex: 1,
    color: '#a7f3d0',
    fontSize: 12,
    lineHeight: 17,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
  },
  offlineNoticeText: {
    flex: 1,
    color: '#bae6fd',
    fontSize: 12,
    lineHeight: 17,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  input: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    paddingVertical: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 12.5,
    fontWeight: '600',
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  advToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 4,
  },
  advToggleText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '600',
  },
  advBox: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  advInput: {
    color: '#f8fafc',
    fontSize: 13,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  versionFooter: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
});
