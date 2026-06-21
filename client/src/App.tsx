import { useEffect, useMemo } from "react";
import { GitBranch, List, Search, Timeline } from "lucide-react";
import { FamilyTreeCanvas } from "./components/FamilyTreeCanvas";
import { useTreeStore, ViewMode } from "./store/treeStore";

const views: Array<{ id: ViewMode; label: string; icon: typeof GitBranch }> = [
  { id: "tree", label: "Árbol", icon: GitBranch },
  { id: "timeline", label: "Cronología", icon: Timeline },
  { id: "list", label: "Personas", icon: List },
];

export function App() {
  const { tree, loading, error, view, query, loadTree, setView, setQuery } = useTreeStore();

  useEffect(() => { void loadTree(); }, [loadTree]);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return tree?.people ?? [];
    return (tree?.people ?? []).filter((person) =>
      `${person.givenNames} ${person.surnames ?? ""} ${person.preferredName ?? ""}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query, tree?.people]);

  const timelineEvents = useMemo(() =>
    (tree?.people ?? [])
      .flatMap((person) => person.events.map((event) => ({ person, event })))
      .filter(({ event }) => event.date)
      .sort((a, b) => (a.event.date?.sortValue ?? 99999999) - (b.event.date?.sortValue ?? 99999999)),
  [tree?.people]);

  return (
    <main className="app-shell">
      <header className="topbar soft-panel">
        <div>
          <p className="eyebrow">Archivo familiar</p>
          <h1>{tree?.name ?? "Family Tree"}</h1>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar una persona…" />
        </label>
      </header>

      <nav className="view-switcher soft-panel" aria-label="Vistas">
        {views.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            <Icon size={18} />{label}
          </button>
        ))}
      </nav>

      <section className="workspace soft-panel">
        {loading && <div className="empty-state">Cargando árbol…</div>}
        {error && <div className="empty-state error">{error}</div>}
        {!loading && !error && view === "tree" && (
          tree?.people.length ? <FamilyTreeCanvas /> : <EmptyTree />
        )}
        {!loading && !error && view === "list" && (
          <div className="people-list">
            {filteredPeople.map((person) => (
              <article key={person.id} className="person-row">
                <span className="avatar">{person.preferredName?.[0] ?? person.givenNames[0]}</span>
                <div><strong>{person.preferredName || person.givenNames} {person.surnames}</strong><small>{person.isLiving ? "Persona viva" : "Fallecida"}</small></div>
              </article>
            ))}
            {!filteredPeople.length && <div className="empty-state">No hay coincidencias.</div>}
          </div>
        )}
        {!loading && !error && view === "timeline" && (
          <div className="timeline-list">
            {timelineEvents.map(({ person, event }) => (
              <article key={event.id} className="timeline-item">
                <time>{event.date?.display}</time>
                <div><strong>{event.title || event.type}</strong><span>{person.givenNames} {person.surnames}</span>{event.place && <small>{event.place}</small>}</div>
              </article>
            ))}
            {!timelineEvents.length && <div className="empty-state">Aún no hay eventos fechados.</div>}
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyTree() {
  return <div className="empty-state"><GitBranch size={44} /><h2>Tu árbol está vacío</h2><p>La base está preparada. El siguiente paso será añadir el editor de personas y relaciones.</p></div>;
}
