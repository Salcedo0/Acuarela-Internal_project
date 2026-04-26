import { useMemo, useState } from "react";

export default function LogPanel({ sent, failed, skipped, progress, status }) {
  const [openSections, setOpenSections] = useState({
    sent: true,
    failed: true,
    skipped: true,
  });

  const progressPercent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const csvRows = useMemo(
    () => [
      ...sent.map((row) => ({
        estado: "enviado",
        telefono: row.number,
        cedula: row.cedula,
        direccion: row.direccion,
        detalle: row.sid || "",
      })),
      ...failed.map((row) => ({
        estado: "fallido",
        telefono: row.number,
        cedula: row.cedula,
        direccion: row.direccion,
        detalle: row.error || "",
      })),
      ...skipped.map((row) => ({
        estado: "no enviado",
        telefono: row.telefonoOriginal,
        cedula: row.cedula,
        direccion: row.direccion,
        detalle: row.razon,
      })),
    ],
    [sent, failed, skipped]
  );

  function toggle(section) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function exportCsv() {
    const headers = ["estado", "telefono", "cedula", "direccion", "detalle"];
    const lines = [
      headers.join(","),
      ...csvRows.map((row) =>
        headers.map((header) => csvEscape(row[header])).join(",")
      ),
    ];

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `log-acuarela-sms-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="log-panel">
      <div className="log-header">
        <div>
          <p className="eyebrow">Resultados</p>
          <h2>Log de envios</h2>
        </div>
        {status === "done" && csvRows.length > 0 && (
          <button type="button" className="ghost-button" onClick={exportCsv}>
            Exportar log CSV
          </button>
        )}
      </div>

      <div className="progress-card">
        <div className="progress-meta">
          <span>
            {progress.current} de {progress.total} procesados
          </span>
          <strong>{progressPercent}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <LogSection
        title="✅ Enviados"
        tone="success"
        count={sent.length}
        open={openSections.sent}
        onToggle={() => toggle("sent")}
      >
        {sent.map((row) => (
          <LogItem
            key={`${row.number}-${row.fila}`}
            number={row.number}
            cedula={row.cedula}
            direccion={row.direccion}
            status="Enviado"
          />
        ))}
      </LogSection>

      <LogSection
        title="❌ Fallidos"
        tone="error"
        count={failed.length}
        open={openSections.failed}
        onToggle={() => toggle("failed")}
      >
        {failed.map((row) => (
          <LogItem
            key={`${row.number}-${row.fila}`}
            number={row.number}
            cedula={row.cedula}
            direccion={row.direccion}
            status={row.error || "Fallido"}
          />
        ))}
      </LogSection>

      <LogSection
        title="⚠️ No enviados"
        tone="warning"
        count={skipped.length}
        open={openSections.skipped}
        onToggle={() => toggle("skipped")}
      >
        {skipped.map((row) => (
          <LogItem
            key={`${row.telefonoOriginal}-${row.fila}`}
            number={row.telefonoOriginal || "Sin telefono"}
            cedula={row.cedula}
            direccion={row.direccion}
            status={row.razon}
          />
        ))}
      </LogSection>
    </section>
  );
}

function LogSection({ title, tone, count, open, onToggle, children }) {
  return (
    <div className={`log-section ${tone}`}>
      <button type="button" className="log-section-title" onClick={onToggle}>
        <span>{title}</span>
        <strong>{count}</strong>
      </button>
      {open && (
        <div className="log-list">
          {count > 0 ? children : <p className="empty-log">Sin registros.</p>}
        </div>
      )}
    </div>
  );
}

function LogItem({ number, cedula, direccion, status }) {
  return (
    <article className="log-item">
      <code>{number}</code>
      <span>{cedula || "Sin cedula"}</span>
      <span>{direccion || "Sin direccion"}</span>
      <strong>{status}</strong>
    </article>
  );
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
