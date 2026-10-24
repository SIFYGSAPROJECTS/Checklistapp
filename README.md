# SIFYGSA Checklist Vehicular (App Android / Tablet — Offline-First)

Aplicación móvil para **Android (Tablets y Smartphones)** desarrollada con **React Native + Expo**, diseñada bajo el flujo de **Recepción Activa Guiada por Fases (Estilo Nissan)** y conectada directamente con la infraestructura de **SIFYGSAFLEET** (PostgreSQL + MinIO en Easypanel).

---

## 🚀 Características Principales

1. **Autocompletado Inteligente por Consecutivo o Placa:**
   * Al elegir una unidad (ej. `AVH-016` / `YLN-733-A`, `AVH-002` / `XX-30120`, `AVH-003` / `YLF-6331`), se pre-cargan automáticamente:
     * Número de Serie (VIN), Marca, Modelo, Línea, Color y Kilometraje anterior.
     * Nombre del Responsable asignado y fecha de vencimiento de su Licencia de Manejo.
     * Número de Póliza de Seguro, fecha de vencimiento de póliza y Bimestre de Verificación Vehicular (Engomado calculado por terminación de placa).
     * Respuestas del **último checklist** registrado para que el inspector solo modifique lo que haya cambiado.

2. **Semáforo de Vigencias en Tiempo Real:**
   * Evalúa automáticamente si la **Póliza de Seguro**, la **Licencia de Manejo** o la **Verificación Vehicular** están:
     * 🟢 **VIGENTES**
     * 🟡 **PRÓXIMOS A VENCER** (menos de 30 días)
     * 🔴 **VENCIDOS** (indicando cuántos días lleva vencido)

3. **Inspección Guiada en 6 Fases con Evidencia Fotográfica:**
   * **Fase 1:** Unidad, Documentos y Semáforo de Vigencias + Fotos de documentos.
   * **Fase 2:** Inventario de unidad (Tapetes, Estéreo, Pantalla, Tarjeta Circulación, Póliza, Manual, Dado) y Herramienta (Gato, Cables, Señales, Extintor, Embudo, Refacción) + Fotos de cajuela/herramienta.
   * **Fase 3:** Odómetro (Kilometraje actual), Funcionamiento interior, Condición mecánica y **Testigos de Alerta del Tablero** + Foto obligatoria de odómetro/tablero.
   * **Fase 4:** Revisión a Cofre Abierto (Aceite, Refrigerante, Bandas, Líquido D.H., Frenos, Mangueras, Tapas) y Estado de las 4 Llantas + Foto de motor.
   * **Fase 5:** Exterior 360° (Golpes, Pintura Rayada/Brizada, Vidrios) y Observaciones numeradas (1 al 9) + Fotos de los 4 ángulos.
   * **Fase 6:** Firmas digitales en pantalla (Responsable y Quien Revisa) y Guardado Offline / Sincronización.

4. **Modo Offline-First y Auto-Sincronización a MinIO:**
   * Funciona al 100% sin internet en patios o sótanos.
   * Permite **Pre-guardar borradores** y encolar múltiples checklists con sus fotos comprimidas en la memoria de la tablet.
   * En cuanto el detector de red (`@react-native-community/netinfo`) detecta Wi-Fi o datos móviles, sube las fotos y firmas a **MinIO** bajo:
     `checklists/<consecutivo>/<fecha>_<folio>/`
   * Genera automáticamente el PDF oficial **"HOJA DE REVISIÓN DE VEHÍCULOS"** + **Anexo Fotográfico** y lo registra en el módulo `/dashboard/checklists` de `SIFYGSAFLEET`.

---

## 🛠️ Cómo ejecutar el proyecto en desarrollo

1. Instalar dependencias en `c:\Proyectos\CheklistApp`:
   ```bash
   cd c:\Proyectos\CheklistApp
   npm install
   ```

2. Iniciar el servidor de Expo:
   ```bash
   npx expo start
   ```

3. Abrir en tu Tablet Android o Emulador:
   * Instala la app **Expo Go** en tu tablet Android y escanea el código QR, o presiona `a` para abrir en Android Studio Emulator.
   * Dentro de la app, toca el ícono de **Engrane (Configuración)** arriba a la derecha para apuntar a `https://cloud.sifygsa.com` (Easypanel) o a la IP local de tu servidor Next.js (`http://192.168.1.XX:3000`).
