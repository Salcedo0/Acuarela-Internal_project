import { useState } from "react";

export default function SendButton({
  canSend,
  disabledReason,
  status,
  count,
  cycleName,
  onConfirm,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isLoading = status === "loading";
  const isDone = status === "done";

  function closeConfirm() {
    if (!isLoading) setConfirmOpen(false);
  }

  function confirmSend() {
    setConfirmOpen(false);
    onConfirm();
  }

  return (
    <section className="send-card">
      <button
        type="button"
        className={`send-button ${isDone ? "done" : ""}`}
        disabled={!canSend || isLoading}
        onClick={() => setConfirmOpen(true)}
      >
        {isLoading ? "Enviando SMS..." : isDone ? "Envio finalizado" : "Enviar SMS"}
      </button>

      {!canSend && !isLoading && (
        <p className="send-hint">{disabledReason}</p>
      )}

      {confirmOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeConfirm}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Confirmar envio</p>
            <h2 id="confirm-title">
              ¿Enviar SMS a {count} usuarios del {cycleName}?
            </h2>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={closeConfirm}>
                Cancelar
              </button>
              <button type="button" className="send-button compact" onClick={confirmSend}>
                Confirmar envio
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
