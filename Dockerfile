FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm install
COPY . .
RUN npm run db:generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL=file:/data/family-tree.db
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --omit=dev --workspace=server && npm cache clean --force
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules/.prisma ./server/node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/prisma ./server/prisma
RUN mkdir -p /data
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --schema server/prisma/schema.prisma && node server/dist/index.js"]
