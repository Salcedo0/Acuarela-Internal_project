export default function MessagePreview({ message, limit, stats }) {
  const count = message.length;
  const isValid = count <= limit;

  return (
    <section className="panel message-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Mensaje</p>
          <h2>Vista previa SMS</h2>
        </div>
        <span className={`char-counter ${isValid ? "ok" : "error"}`}>
          {count} / {limit}
        </span>
      </div>

      <pre className="message-preview">{message || "Selecciona un ciclo."}</pre>

      <div className="stats-row">
        <span>{stats.validos} numeros validos</span>
        <span>{stats.invalidos} invalidos</span>
        <span>{stats.fijos} fijos</span>
      </div>
    </section>
  );
}
