export default function MessagePreview({
  messages,
  limit,
  stats,
  unitLabel = "ciclos",
  note = "",
}) {
  const previews =
    messages.length > 0
      ? messages
      : [{ cycleId: "empty", cycleName: "", message: "Selecciona un ciclo." }];
  const hasMultipleMessages = messages.length > 1;
  const hasInvalidMessage = messages.some((item) => item.message.length > limit);
  const firstCount = messages[0]?.message.length || 0;

  return (
    <section className="panel message-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Mensaje</p>
          <h2>Vista previa SMS</h2>
        </div>
        <span className={`char-counter ${hasInvalidMessage ? "error" : "ok"}`}>
          {hasMultipleMessages
            ? `${messages.length} ${unitLabel}`
            : `${firstCount} / ${limit}`}
        </span>
      </div>

      {note && <p className="send-hint">{note}</p>}

      <div className="message-stack">
        {previews.map((item) => {
          const count = item.message.length;
          const isValid = count <= limit;

          return (
            <div className="message-preview-item" key={item.cycleId}>
              {hasMultipleMessages && (
                <div className="message-preview-meta">
                  <strong>{item.cycleName}</strong>
                  <span className={`char-counter ${isValid ? "ok" : "error"}`}>
                    {count} / {limit}
                  </span>
                </div>
              )}
              <pre className="message-preview">{item.message}</pre>
            </div>
          );
        })}
      </div>

      <div className="stats-row">
        <span>{stats.validos} numeros validos</span>
        <span>{stats.invalidos} invalidos</span>
        <span>{stats.fijos} fijos</span>
        {messages.length > 1 && unitLabel === "ciclos" && (
          <span>{messages.length} ciclos seleccionados</span>
        )}
      </div>
    </section>
  );
}
