# Atlasgymroom App Web

Base inicial del sistema de gestión de Atlasgymroom.

## Estado actual
Prototipo frontend con datos ficticios. Todavía no incluye backend, base de datos, autenticación real, pagos ni sincronización offline. No introducir datos reales de miembros.

## Tecnologías
- React + TypeScript
- Vite
- Lucide React
- GitHub Actions para compilar y publicar en GitHub Pages (cuando el propietario active Pages).

## Desarrollo local
```bash
npm install
npm run dev
```

## Compilar
```bash
npm run build
npm run preview
```

## GitHub Pages
El proyecto usa `base: '/Atlasgymroom-App-Web/'`. El workflow `.github/workflows/deploy-pages.yml` queda preparado, pero Pages no se activa automáticamente.

## Próximas etapas
1. Validar pantallas y flujos con el gimnasio.
2. Definir roles y permisos.
3. Elegir backend y base de datos.
4. Implementar miembros, planes, pagos y asistencia.
5. Implementar ventas, inventario y caja.
6. Diseñar sincronización offline y auditoría.
