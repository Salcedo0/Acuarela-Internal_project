import { useRef, useState } from "react";

export default function FileUploader({
  fileName,
  status,
  error,
  stats,
  onFileSelect,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState("");

  function chooseFile() {
    inputRef.current?.click();
  }

  function validateAndSend(file) {
    setLocalError("");

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setLocalError("Solo se aceptan archivos .xlsx.");
      return;
    }

    onFileSelect(file);
  }

  function handleInputChange(event) {
    validateAndSend(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    validateAndSend(event.dataTransfer.files?.[0]);
  }

  return (
    <section className="panel upload-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Archivo fuente</p>
          <h2>Usuarios por cobrar</h2>
        </div>
      </div>

      <button
        type="button"
        className={`drop-zone ${isDragging ? "is-dragging" : ""}`}
        onClick={chooseFile}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={handleInputChange}
          hidden
        />

        <span className="upload-icon" aria-hidden="true">
          ↑
        </span>
        <strong>{fileName || "Subir archivo .xlsx"}</strong>
        <small>Arrastra el Excel o selecciona el archivo</small>
      </button>

      {status === "loading" && (
        <div className="status-line">
          <span className="spinner" aria-hidden="true" />
          Procesando archivo...
        </div>
      )}

      {status === "done" && (
        <div className="upload-summary reveal">
          <span>{stats.total} filas detectadas</span>
          <span>{stats.validos} validos</span>
          <span>{stats.invalidos} no enviados</span>
        </div>
      )}

      {(localError || error) && (
        <p className="form-error">{localError || error}</p>
      )}

      {fileName && (
        <button type="button" className="ghost-button" onClick={chooseFile}>
          Cambiar archivo
        </button>
      )}
    </section>
  );
}
