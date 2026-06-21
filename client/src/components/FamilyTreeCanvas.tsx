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

type PersonNodeData = { person: Person };

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
    const generationBuckets = new Map<number, Person[]>();

    for (const person of people) {
      const depth = generationDepth(person.id, parentsByChild, depthCache);
      const bucket = generationBuckets.get(depth) ?? [];
      bucket.push(person);
      generationBuckets.set(depth, bucket);
    }

    const flowNodes: PersonNode[] = [];
    for (const [depth, generation] of generationBuckets) {
      generation.forEach((person, index) => {
        flowNodes.push({
          id: person.id,
          type: "person",
          data: { person },
          position: { x: index * 270, y: depth * 210 },
        });
      });
    }

    const relationshipEdges: Edge[] = parentRelations.map((relation) => ({
      id: `parent-${relation.parentId}-${relation.childId}-${relation.type}`,
      source: relation.parentId,
      target: relation.childId,
      type: "smoothstep",
      className: relation.type === "BIOLOGICAL" ? "edge-biological" : "edge-social",
      label: relation.type === "BIOLOGICAL" ? undefined : relation.type.toLowerCase(),
    }));

    const partnershipEdges: Edge[] = partnerships.map((partnership) => ({
      id: `partner-${partnership.id}`,
      source: partnership.partnerAId,
      target: partnership.partnerBId,
      type: "straight",
      className: "edge-partnership",
    }));

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
        onNodeClick={(_, node) => selectPerson(node.id)}
      >
        <Background gap={28} size={1} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
