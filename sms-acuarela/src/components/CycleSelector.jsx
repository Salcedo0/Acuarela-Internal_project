export default function CycleSelector({ cycles, selectedCycleId, onSelect }) {
  const selectedCycle = cycles[selectedCycleId];

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Configuracion</p>
          <h2>Ciclo de cobro</h2>
        </div>
      </div>

      <div className="cycle-tabs" role="tablist" aria-label="Ciclos de cobro">
        {Object.entries(cycles).map(([cycleId, cycle]) => (
          <button
            key={cycleId}
            type="button"
            className={cycleId === selectedCycleId ? "active" : ""}
            disabled={cycle.pendiente}
            title={cycle.pendiente ? "Fechas pendientes" : cycle.name}
            onClick={() => onSelect(cycleId)}
          >
            {cycle.name.replace("Ciclo ", "")}
          </button>
        ))}
      </div>

      <div className="cycle-detail">
        {selectedCycle.pendiente ? (
          <p>Fechas pendientes.</p>
        ) : (
          <>
            <Detail label="SMS" value={selectedCycle.fechaSMS} />
            <Detail label="Pago oportuno" value={selectedCycle.fechaOportuna} />
            <Detail label="Suspension" value={selectedCycle.fechaSuspension} />
            <Detail label="Fecha maxima" value={selectedCycle.fechaMaxima} />
          </>
        )}
      </div>
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
