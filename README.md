# Family Tree

Aplicación web local y monousuario para gestionar árboles genealógicos complejos.

## Stack

- React + Vite + TypeScript + Tailwind CSS
- React Flow para el árbol virtualizado
- Zustand para estado global
- Fastify + TypeScript
- Prisma ORM + SQLite
- Docker en una única imagen

## Desarrollo local

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3000`

## Docker

```bash
docker build -t family-tree .
docker run --rm -p 3000:3000 -v family-tree-data:/data family-tree
```

La aplicación estará disponible en `http://localhost:3000` y la base SQLite se conservará en el volumen `family-tree-data`.

## Arquitectura

```text
client/                 React, vistas y estado
  src/components/       Componentes visuales
  src/store/            Estado Zustand
server/                 API Fastify
  prisma/               Esquema SQLite
  src/                  API y servidor estático
```

El modelo separa personas, relaciones padre-hijo y parejas. Esto permite múltiples cónyuges, hijos con distintas parejas, adopciones, tutelas y familias reconstituidas.

La autenticación es opcional y global. Si se activa en el futuro, protegerá la aplicación completa sin crear usuarios propietarios ni separar los datos.
