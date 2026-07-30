import { useEffect, useState } from "react";

const DATE_FIELDS = [{ key: "fechaMaxima", label: "Fecha maxima" }];

export default function CycleSelector({
  cycles,
  activeCycleId,
  selectedCycleIds,
  multiCycleEnabled,
  onMultiCycleChange,
  onSelect,
  onSaveCycle,
}) {
  const selectedCycle = cycles[activeCycleId];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(selectedCycle));

  useEffect(() => {
    setEditing(false);
    setDraft(createDraft(selectedCycle));
  }, [activeCycleId, selectedCycle]);

  function startEditing() {
    setDraft(createDraft(selectedCycle));
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(createDraft(selectedCycle));
    setEditing(false);
  }

  function saveEditing() {
    onSaveCycle(activeCycleId, normalizeDraft(draft));
    setEditing(false);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Configuracion</p>
          <h2>Ciclo de cobro</h2>
        </div>
      </div>

      <label className="multi-cycle-toggle">
        <input
          type="checkbox"
          checked={multiCycleEnabled}
          onChange={(event) => onMultiCycleChange(event.target.checked)}
        />
        <span>Seleccionar varios ciclos</span>
      </label>

      <div className="cycle-tabs" role="tablist" aria-label="Ciclos de cobro">
        {Object.entries(cycles).map(([cycleId, cycle]) => {
          const isSelected = selectedCycleIds.includes(cycleId);
          const isActive = activeCycleId === cycleId;

          return (
            <button
              key={cycleId}
              type="button"
              className={`${isSelected ? "active" : ""} ${isActive ? "focused" : ""}`}
              disabled={cycle.pendiente}
              title={cycle.pendiente ? "Fechas pendientes" : cycle.name}
              aria-pressed={isSelected}
              onClick={() => onSelect(cycleId)}
            >
              {cycle.name.replace("Ciclo ", "")}
            </button>
          );
        })}
      </div>

      <div className="cycle-detail">
        {selectedCycle.pendiente ? (
          <p>Fechas pendientes.</p>
        ) : editing ? (
          <div className="cycle-edit-form">
            {DATE_FIELDS.map((field) => (
              <label className="cycle-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  type="text"
                  value={draft[field.key]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}

            <div className="cycle-edit-actions">
              <button type="button" className="ghost-button" onClick={cancelEditing}>
                Cancelar
              </button>
              <button type="button" className="save-cycle-button" onClick={saveEditing}>
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="cycle-detail-header">
              <strong>{selectedCycle.name}</strong>
              <button type="button" className="ghost-button" onClick={startEditing}>
                Editar
              </button>
            </div>
            <Detail label="Fecha maxima" value={selectedCycle.fechaMaxima} />
          </>
        )}
      </div>
    </section>
  );
}

function createDraft(cycle) {
  return DATE_FIELDS.reduce((draft, field) => {
    draft[field.key] = cycle?.[field.key] || "";
    return draft;
  }, {});
}

function normalizeDraft(draft) {
  return DATE_FIELDS.reduce((updates, field) => {
    updates[field.key] = draft[field.key].trim();
    return updates;
  }, {});
}

function Detail({ label, value }) {
  return (
    <div className="cycle-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
