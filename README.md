# Atlasgymroom App Web

Aplicación de administración para un gimnasio de una sede. Incluye panel, socios, planes, pagos, asistencia, pases diarios, ventas, inventario, compras, gastos, caja, informes, PWA y cola de operaciones offline de un dispositivo.

## Estado y límites importantes

**Aviso de privacidad:** el repositorio está actualmente configurado como público. Antes de introducir datos personales, claves o información interna, cámbialo a privado desde GitHub Settings → General → Danger Zone → Change repository visibility. No se han subido claves ni datos de socios.

- La interfaz y los flujos principales están implementados.
- Con configuración Supabase: autenticación por usuario, base PostgreSQL, RLS y operaciones de negocio transaccionales.
- Sin configurar Supabase: funciona en modo local usando IndexedDB del navegador. Los datos quedan únicamente en ese dispositivo y **no tienen autenticación multiusuario ni respaldo remoto**.
- El modo offline está diseñado para conservar operaciones en un dispositivo y sincronizarlas al volver Internet. No habilita varios dispositivos desconectados compartiendo inventario en tiempo real.
- No usar datos personales ni financieros reales hasta configurar Supabase, promover la cuenta propietaria, validar los permisos y hacer las pruebas de aceptación.
- El repositorio debe permanecer privado antes de incorporar datos o secretos. No publicar claves secretas.

## Módulos y estado funcional

- Punto de venta tipo catálogo de juego de gestión: tarjetas visuales por producto, búsqueda, filtros por categoría, fotos, carrito editable, control de stock, medios de pago y registro de venta sin pedir datos del comprador.
- Ventas y cartera: consulta de ventas y módulo filtrado de cuentas por cobrar.
- Gestión auxiliar: evoluciones, rutinas, ejercicios, proveedores, empleados, clases, reservaciones, tipos de gastos, categorías de productos, documentos soporte, notas de ajuste/débito/crédito, y registros administrativos.
- Cobro de entrada general: registra la tarifa diaria de $4.000 sin pedir nombre, cédula ni ficha de cliente; se refleja en asistencia, caja y movimientos.
- Imágenes de productos: modo local usa imágenes optimizadas en el almacenamiento local; con Supabase utiliza el bucket `product-images`.
- El tablero incluye tendencias de ingresos de siete días, ventas agrupadas por categoría, indicadores y accesos inmediatos.
- Configuración incluye un reinicio explícito para datos de prueba; borra registros operativos conservando usuarios y tarifas. Requiere escribir `REINICIAR`; en Supabase se restringe al propietario.
- Los módulos auxiliares usan la tabla genérica `gym_records` y ofrecen altas, consulta, edición y búsqueda. No equivalen todavía a sistemas especializados de rutinas con ejercicios prescritos, envío de correos, reservas con cupos ni documentos electrónicos DIAN.
- Los módulos de kardex y movimientos de inventario son de consulta. La creación de ajustes de stock con aprobación y motivo queda pendiente de una operación transaccional específica.

### Migración adicional

Si ya existe un proyecto Supabase, ejecutar las migraciones 0002 y 0003 después de la inicial para habilitar los módulos auxiliares, el catálogo de imágenes y el reinicio del entorno de pruebas. No basta con publicar GitHub Pages: Supabase debe estar configurado y autenticado para sincronización compartida.

## 1. Ejecutar en local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Para modo local sin backend, deja vacías las variables de Supabase. Se mostrará una advertencia permanente de almacenamiento solo en este navegador.

## 2. Crear el backend Supabase

1. Crear un proyecto en Supabase.
2. Abrir **SQL Editor** y ejecutar en orden `supabase/migrations/202611080001_initial_schema.sql`, `supabase/migrations/202611080002_gym_records.sql` y `supabase/migrations/202611080003_pos_catalog_images_reset.sql`.
3. En **Authentication → Users**, crear el usuario propietario con correo y contraseña.
4. Ejecutar al final del SQL (sustituyendo el correo):
   ```sql
   update public.profiles
   set role = 'owner'
   where id = (select id from auth.users where email = 'CORREO_DEL_DUENO');
   ```
5. Copiar Project URL y Publishable key desde el panel **Connect**.
6. Guardarlas como `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local` para desarrollo. Para GitHub Pages, créalas también en **Settings → Secrets and variables → Actions → Variables** con esos mismos nombres. El workflow de publicación las inyecta durante la compilación.
7. Crear los empleados desde Authentication → Users. El trigger crea su perfil como `cashier`. No compartir cuentas.
8. Nunca colocar `service_role` ni claves secretas en variables `VITE_*`.

## 3. Publicación

El proyecto está configurado para `https://<usuario>.github.io/Atlasgymroom-App-Web/`. El workflow de Pages ya está en el repositorio, pero el propietario debe activar Pages y configurar el entorno. GitHub Pages es solo alojamiento estático: no reemplaza Supabase.

La aplicación requiere que las variables de entorno estén presentes al compilar. Las claves públicas son visibles en el navegador por diseño; la protección real de datos depende de Auth y RLS.

## 4. Respaldo local

Desde Configuración se puede exportar un archivo JSON de respaldo del almacenamiento local del dispositivo. El archivo puede contener datos personales: guárdalo en un lugar privado. La importación agrega/actualiza los registros del respaldo en el dispositivo actual.

## 5. Reglas de operación

- Las escrituras de pagos, ventas, pases diarios, compras, gastos, caja y movimientos de stock quedan restringidas a funciones transaccionales de la base de datos; el cliente no recibe permisos de inserción directa para esos libros.
- La creación de productos y su stock inicial se realiza mediante una función exclusiva del propietario. El stock posterior cambia mediante venta o compra.
- El cierre de caja es idempotente: repetir la solicitud no vuelve a cerrar ni altera el resultado registrado.


- Los pagos, ventas, pases diarios, gastos y compras usan funciones SQL transaccionales cuando hay conexión.
- Cada movimiento utiliza UUID estable para que una repetición tras pérdida de conexión no lo duplique.
- No hay botones para borrar movimientos financieros; las anulaciones/correcciones deben conservar el original y añadirse como movimientos compensatorios en una siguiente iteración.
- Las transferencias/Nequi deben confirmarse realmente antes de marcarlas como recibidas. Una captura de pantalla no es confirmación bancaria.
- Para un apagón, la PWA no sustituye energía de respaldo; usar batería/UPS o el procedimiento manual del gimnasio.
- Mantener el software anterior en paralelo hasta comparar pagos, ingresos, caja e inventario y aprobar restauración de respaldo.

## 6. Verificación previa a producción

- Crear usuario propietario y un usuario de caja; verificar que RLS limita las acciones del segundo.
- Crear plan y miembro; registrar pago completo, parcial y pendiente.
- Crear clientes con cédula obligatoria; buscar por cédula o nombre; registrar entrada solo con tarifa vigente.
- Pausar una membresía vigente y reactivarla comprobando que la fecha final se compense por los días pausados.
- Registrar entrada de socio y pase diario (sin crear miembro permanente).
- Registrar pagos parciales, consultar Cuentas por Cobrar Pagos y cobrar saldos pendientes sin duplicar movimientos.
- Cobrar una entrada general sin registrar cliente; verificar asistencia, caja y movimiento.
- Crear un producto con foto, categoría, precio y existencia inicial; verificar que aparece como tarjeta en catálogo y punto de venta.
- Vender dos productos sin identificar comprador; comprobar detalle de venta, saldo e inventario.
- Registrar compra y verificar entrada de inventario.
- Registrar gasto y comparar efectivo esperado.
- Abrir/cerrar caja y validar diferencia.
- Probar pérdida de Internet en un dispositivo, recuperación y sincronización sin duplicados.
- Exportar/importar respaldo y comparar totales.
- Comparar el sistema nuevo con el actual durante un periodo paralelo.

La aplicación no debe considerarse producción hasta completar estas pruebas en el proyecto Supabase real.

## 7. Detalles de Tarifas y módulos extendidos

- La ficha de Tarifas guarda tipo (normal/ticket), días, cantidad de tiquetes, permiso para modificar precio, horarios, días disponibles y campos de información tributaria mostrados en el sistema actual.
- Los horarios/días y los campos tributarios se almacenan como configuración de la tarifa; esta versión todavía no genera factura electrónica ni calcula/declarara impuestos DIAN.
- El menú conserva los nombres de Administración, Pagos, Ventas, Clientes, Terceros, Egresos, Productos y Reservaciones. Los apartados de evoluciones, rutinas, ejercicios, documentos soporte, notas, reservas y configuraciones avanzadas están señalados como módulos pendientes, no como funciones listas.
- Los tickets se dejan inactivos hasta que el dueño configure su precio real y los active; no se inventaron precios para esos tickets.
