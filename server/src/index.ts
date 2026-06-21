import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

await app.register(cors, { origin: true });

app.get("/api/health", async () => ({ status: "ok" }));

app.get("/api/tree", async () => {
  const tree = await prisma.tree.findFirst({
    include: {
      people: {
        include: {
          events: { include: { date: true } },
          media: true,
          parentLinks: true,
          childLinks: true,
          appearances: true,
        },
      },
      partnerships: {
        include: { startDate: true, endDate: true },
      },
    },
  });

  return tree ?? { id: null, name: "Mi familia", people: [], partnerships: [] };
});

app.post("/api/tree", async (request, reply) => {
  const body = request.body as { name?: string; description?: string };
  const existing = await prisma.tree.findFirst();
  if (existing) return reply.code(409).send({ message: "Ya existe un árbol" });

  return prisma.tree.create({
    data: { name: body.name?.trim() || "Mi familia", description: body.description },
  });
});

app.post("/api/people", async (request, reply) => {
  const body = request.body as {
    treeId?: string;
    givenNames?: string;
    surnames?: string;
    preferredName?: string;
    sex?: "FEMALE" | "MALE" | "INTERSEX" | "UNKNOWN" | "OTHER";
  };

  if (!body.givenNames?.trim()) {
    return reply.code(400).send({ message: "El nombre es obligatorio" });
  }

  const tree = body.treeId
    ? await prisma.tree.findUnique({ where: { id: body.treeId } })
    : await prisma.tree.findFirst();

  const targetTree = tree ?? await prisma.tree.create({ data: { name: "Mi familia" } });

  return prisma.person.create({
    data: {
      treeId: targetTree.id,
      givenNames: body.givenNames.trim(),
      surnames: body.surnames?.trim() || null,
      preferredName: body.preferredName?.trim() || null,
      sex: body.sex ?? "UNKNOWN",
      appearances: { create: { contextKey: "primary" } },
    },
    include: { appearances: true },
  });
});

app.post("/api/people/:personId/appearances", async (request, reply) => {
  const { personId } = request.params as { personId: string };
  const body = request.body as {
    contextKey?: string;
    x?: number;
    y?: number;
    generation?: number;
  };

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) return reply.code(404).send({ message: "Persona no encontrada" });

  return prisma.personAppearance.create({
    data: {
      personId,
      contextKey: body.contextKey?.trim() || `appearance-${Date.now()}`,
      x: body.x,
      y: body.y,
      generation: body.generation,
    },
  });
});

app.get("/api/settings", async () => {
  return prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
    select: { authenticationEnabled: true, updatedAt: true },
  });
});

await app.register(fastifyStatic, {
  root: clientDist,
  wildcard: false,
});

app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/")) {
    return reply.code(404).send({ message: "Ruta no encontrada" });
  }
  return reply.sendFile("index.html");
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
