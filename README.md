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

## 1. Ejecutar en local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Para modo local sin backend, deja vacías las variables de Supabase. Se mostrará una advertencia permanente de almacenamiento solo en este navegador.

## 2. Crear el backend Supabase

1. Crear un proyecto en Supabase.
2. Abrir **SQL Editor** y ejecutar completo `supabase/migrations/202611080001_initial_schema.sql`.
3. En **Authentication → Users**, crear el usuario propietario con correo y contraseña.
4. Ejecutar al final del SQL (sustituyendo el correo):
   ```sql
   update public.profiles
   set role = 'owner'
   where id = (select id from auth.users where email = 'CORREO_DEL_DUENO');
   ```
5. Copiar Project URL y Publishable key desde el panel **Connect**.
6. Guardarlas como `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local` para desarrollo y como variables de entorno del alojamiento para producción.
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
- Registrar entrada de socio y pase diario (sin crear miembro permanente).
- Vender dos productos; comprobar existencias y detalle de venta.
- Registrar compra y verificar entrada de inventario.
- Registrar gasto y comparar efectivo esperado.
- Abrir/cerrar caja y validar diferencia.
- Probar pérdida de Internet en un dispositivo, recuperación y sincronización sin duplicados.
- Exportar/importar respaldo y comparar totales.
- Comparar el sistema nuevo con el actual durante un periodo paralelo.

La aplicación no debe considerarse producción hasta completar estas pruebas en el proyecto Supabase real.
