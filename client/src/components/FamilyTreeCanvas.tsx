import { memo, useMemo } from "react";
import {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import { Person, useTreeStore } from "../store/treeStore";

type PersonNodeData = { person: Person; repeated: boolean };
type PersonNode = Node<PersonNodeData, "person">;

const PersonCard = memo(({ data, selected }: NodeProps<PersonNode>) => {
  const person = data.person;
  const birth = person.events.find((event) => event.type === "BIRTH")?.date?.display;
  const death = person.events.find((event) => event.type === "DEATH")?.date?.display;

  return (
    <article className={`person-node ${selected ? "person-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="person-node__avatar">
        {person.preferredName?.[0] ?? person.givenNames[0] ?? "?"}
      </div>
      <div className="person-node__body">
        <strong>{person.preferredName || person.givenNames}</strong>
        <span>{person.surnames || "Apellidos desconocidos"}</span>
        <small>{birth || "?"} — {person.isLiving ? "Actualidad" : death || "?"}</small>
        {data.repeated && <small aria-label="Persona repetida en el árbol">Misma persona · otra rama</small>}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </article>
  );
});

PersonCard.displayName = "PersonCard";
const nodeTypes = { person: PersonCard };

function generationDepth(
  personId: string,
  parentsByChild: Map<string, string[]>,
  cache: Map<string, number>,
  visiting = new Set<string>(),
): number {
  const cached = cache.get(personId);
  if (cached !== undefined) return cached;
  if (visiting.has(personId)) return 0;

  visiting.add(personId);
  const parents = parentsByChild.get(personId) ?? [];
  const depth = parents.length
    ? Math.max(...parents.map((id) => generationDepth(id, parentsByChild, cache, visiting))) + 1
    : 0;
  visiting.delete(personId);
  cache.set(personId, depth);
  return depth;
}

function closestAppearance(
  appearances: PersonNode[],
  target: PersonNode,
): PersonNode | undefined {
  return appearances.reduce<PersonNode | undefined>((closest, candidate) => {
    if (!closest) return candidate;
    const candidateDistance = Math.abs(candidate.position.y - target.position.y) + Math.abs(candidate.position.x - target.position.x);
    const closestDistance = Math.abs(closest.position.y - target.position.y) + Math.abs(closest.position.x - target.position.x);
    return candidateDistance < closestDistance ? candidate : closest;
  }, undefined);
}

export function FamilyTreeCanvas() {
  const people = useTreeStore((state) => state.tree?.people ?? []);
  const partnerships = useTreeStore((state) => state.tree?.partnerships ?? []);
  const selectPerson = useTreeStore((state) => state.selectPerson);

  const { nodes, edges } = useMemo(() => {
    const parentsByChild = new Map<string, string[]>();
    const parentRelations = people.flatMap((person) => person.parentLinks);

    for (const relation of parentRelations) {
      const parents = parentsByChild.get(relation.childId) ?? [];
      parents.push(relation.parentId);
      parentsByChild.set(relation.childId, parents);
    }

    const depthCache = new Map<string, number>();
    const fallbackIndexByGeneration = new Map<number, number>();
    const flowNodes: PersonNode[] = [];
    const nodesByPerson = new Map<string, PersonNode[]>();

    for (const person of people) {
      const baseDepth = generationDepth(person.id, parentsByChild, depthCache);
      const appearances = person.appearances?.length
        ? person.appearances
        : [{ id: `primary-${person.id}`, contextKey: "primary", generation: baseDepth }];

      appearances.forEach((appearance, appearanceIndex) => {
        const generation = appearance.generation ?? baseDepth;
        const fallbackIndex = fallbackIndexByGeneration.get(generation) ?? 0;
        fallbackIndexByGeneration.set(generation, fallbackIndex + 1);

        const node: PersonNode = {
          id: appearance.id,
          type: "person",
          data: { person, repeated: appearances.length > 1 },
          position: {
            x: appearance.x ?? fallbackIndex * 270,
            y: appearance.y ?? generation * 210 + appearanceIndex * 12,
          },
        };

        flowNodes.push(node);
        const personNodes = nodesByPerson.get(person.id) ?? [];
        personNodes.push(node);
        nodesByPerson.set(person.id, personNodes);
      });
    }

    const relationshipEdges: Edge[] = [];
    for (const relation of parentRelations) {
      const parentAppearances = nodesByPerson.get(relation.parentId) ?? [];
      const childAppearances = nodesByPerson.get(relation.childId) ?? [];

      for (const childAppearance of childAppearances) {
        const parentAppearance = closestAppearance(parentAppearances, childAppearance);
        if (!parentAppearance) continue;
        relationshipEdges.push({
          id: `parent-${relation.id ?? `${relation.parentId}-${relation.childId}-${relation.type}`}-${childAppearance.id}`,
          source: parentAppearance.id,
          target: childAppearance.id,
          type: "smoothstep",
          className: relation.type === "BIOLOGICAL" ? "edge-biological" : "edge-social",
          label: relation.type === "BIOLOGICAL" ? undefined : relation.type.toLowerCase(),
        });
      }
    }

    const partnershipEdges: Edge[] = partnerships.flatMap((partnership) => {
      const left = nodesByPerson.get(partnership.partnerAId) ?? [];
      const right = nodesByPerson.get(partnership.partnerBId) ?? [];
      if (!left.length || !right.length) return [];

      return left.map((leftAppearance) => {
        const rightAppearance = closestAppearance(right, leftAppearance)!;
        return {
          id: `partner-${partnership.id}-${leftAppearance.id}-${rightAppearance.id}`,
          source: leftAppearance.id,
          target: rightAppearance.id,
          type: "straight",
          className: "edge-partnership",
        } satisfies Edge;
      });
    });

    return { nodes: flowNodes, edges: [...relationshipEdges, ...partnershipEdges] };
  }, [people, partnerships]);

  return (
    <div className="tree-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements
        minZoom={0.08}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => selectPerson(node.data.person.id)}
      >
        <Background gap={28} size={1} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
