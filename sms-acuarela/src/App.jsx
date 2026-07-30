import { useMemo, useRef, useState } from "react";
import FileUploader from "./components/FileUploader.jsx";
import CycleSelector from "./components/CycleSelector.jsx";
import MessagePreview from "./components/MessagePreview.jsx";
import SendButton from "./components/SendButton.jsx";
import LogPanel from "./components/LogPanel.jsx";
import { CYCLES } from "./constants/cycles.js";
import { parseExcel, FORMATO_CONSOLIDADO } from "./utils/parseExcel.js";
import { buildSmsMessage, SMS_LIMIT } from "./utils/message.js";

// Se define en build con VITE_SEND_ENDPOINT (ver .env.example).
// El fallback es solo para desarrollo local.
const SEND_ENDPOINT =
  import.meta.env.VITE_SEND_ENDPOINT || "http://localhost:3001/send-sms";

// Lotes chicos: 2974 envios en una sola peticion se mueren por timeout del proxy.
const BATCH_SIZE = 50;

const emptyData = {
  validos: [],
  invalidos: [],
  total: 0,
  formato: null,
  duplicados: [],
  segmentos: 0,
  conTildes: 0,
};

function chunk(list, size) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

export default function App() {
  const [cycles, setCycles] = useState(() => CYCLES);
  const [multiCycleEnabled, setMultiCycleEnabled] = useState(false);
  const [activeCycleId, setActiveCycleId] = useState("1");
  const [selectedCycleIds, setSelectedCycleIds] = useState(["1"]);
  const [fileName, setFileName] = useState("");
  const [excelData, setExcelData] = useState(emptyData);
  const [parseState, setParseState] = useState("idle");
  const [parseError, setParseError] = useState("");
  const [sentLogs, setSentLogs] = useState([]);
  const [failedLogs, setFailedLogs] = useState([]);
  const [sendState, setSendState] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  const cancelRef = useRef(false);

  const activeCycle = cycles[activeCycleId];
  // El Excel consolidado trae un mensaje ya redactado por fila: no se usan ciclos.
  const isConsolidado = excelData.formato === FORMATO_CONSOLIDADO;
  const selectedMessages = useMemo(
    () =>
      Object.entries(cycles)
        .filter(([cycleId, cycle]) => selectedCycleIds.includes(cycleId) && !cycle.pendiente)
        .map(([cycleId, cycle]) => ({
          cycleId,
          cycleName: cycle.name,
          message: buildSmsMessage(cycle),
        })),
    [cycles, selectedCycleIds]
  );

  const fixedCount = useMemo(
    () => excelData.invalidos.filter((row) => row.razon === "Número fijo").length,
    [excelData.invalidos]
  );

  const stats = {
    total: excelData.total,
    validos: excelData.validos.length,
    invalidos: excelData.invalidos.length,
    fijos: fixedCount,
  };

  // En consolidado la vista previa son mensajes reales del archivo, no plantillas de ciclo.
  const previewMessages = useMemo(() => {
    if (!isConsolidado) return selectedMessages;

    return excelData.validos.slice(0, 3).map((row) => ({
      cycleId: `fila-${row.fila}`,
      cycleName: row.nombre || `Fila ${row.fila}`,
      message: row.mensaje,
    }));
  }, [isConsolidado, selectedMessages, excelData.validos]);

  async function handleFileSelect(file) {
    if (!file) return;

    setFileName(file.name);
    setParseState("loading");
    setParseError("");
    setExcelData(emptyData);
    setSentLogs([]);
    setFailedLogs([]);
    setSendState("idle");
    setProgress({ current: 0, total: 0 });
    setShowConfetti(false);

    try {
      const parsed = await parseExcel(file);
      setExcelData(parsed);
      setParseState("done");
    } catch (error) {
      setParseState("error");
      setParseError(error.message || "No se pudo leer el archivo Excel.");
    }
  }

  function cancelSend() {
    cancelRef.current = true;
  }

  // Envio consolidado: cada fila lleva su propio texto, agrupado en lotes.
  async function sendConsolidatedSms() {
    const recipients = excelData.validos;
    const batches = chunk(recipients, BATCH_SIZE);
    let processed = 0;

    setSendState("loading");
    setSentLogs([]);
    setFailedLogs([]);
    setProgress({ current: 0, total: recipients.length });
    setShowConfetti(false);
    cancelRef.current = false;

    let failedCount = 0;

    for (const batch of batches) {
      if (cancelRef.current) break;

      const byRef = new Map(batch.map((row) => [row.fila, row]));

      try {
        const response = await fetch(SEND_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: batch.map((row) => ({
              number: row.telefono,
              message: row.mensaje,
              ref: row.fila,
            })),
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "El backend rechazo el lote.");
        }

        const results = Array.isArray(payload.results) ? payload.results : [];

        results.forEach((result) => {
          const row = byRef.get(result.ref) || {};
          const logItem = {
            ...row,
            cycleId: `fila-${row.fila ?? result.ref}`,
            cycleName: row.nombre || "",
            number: result.number,
            status: result.status === "sent" ? "sent" : "failed",
            error: result.error || "",
            sid: result.sid || "",
          };

          if (logItem.status === "sent") {
            setSentLogs((current) => [...current, logItem]);
          } else {
            failedCount += 1;
            setFailedLogs((current) => [...current, logItem]);
          }
        });

        // Si el backend devolvio menos resultados que envios, marcamos el resto como fallido
        // para que ninguna fila quede en silencio.
        const respondidos = new Set(results.map((result) => result.ref));
        batch
          .filter((row) => !respondidos.has(row.fila))
          .forEach((row) => {
            failedCount += 1;
            setFailedLogs((current) => [
              ...current,
              {
                ...row,
                cycleId: `fila-${row.fila}`,
                cycleName: row.nombre || "",
                number: row.telefono,
                status: "failed",
                error: "El backend no devolvio resultado para esta fila.",
              },
            ]);
          });
      } catch (error) {
        batch.forEach((row) => {
          failedCount += 1;
          setFailedLogs((current) => [
            ...current,
            {
              ...row,
              cycleId: `fila-${row.fila}`,
              cycleName: row.nombre || "",
              number: row.telefono,
              status: "failed",
              error: error.message || "Error de conexion con el backend.",
            },
          ]);
        });
      }

      processed += batch.length;
      setProgress({ current: processed, total: recipients.length });
    }

    setSendState("done");

    if (!cancelRef.current && recipients.length > 0 && failedCount === 0) {
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 3800);
    }
  }

  async function sendAllSms() {
    if (isConsolidado) {
      await sendConsolidatedSms();
      return;
    }

    const recipients = excelData.validos;
    const messagesToSend = selectedMessages;
    const totalSends = recipients.length * messagesToSend.length;
    let processed = 0;

    setSendState("loading");
    setSentLogs([]);
    setFailedLogs([]);
    setProgress({ current: 0, total: totalSends });
    setShowConfetti(false);
    cancelRef.current = false;

    const sent = [];
    const failed = [];

    for (const cycleMessage of messagesToSend) {
      if (cancelRef.current) break;

      for (const recipient of recipients) {
        if (cancelRef.current) break;

        processed += 1;

        try {
          const response = await fetch(SEND_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              numbers: [recipient.telefono],
              message: cycleMessage.message,
            }),
          });

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(payload.error || "El backend rechazo el envio.");
          }

          const result = payload.results?.[0];
          const logItem = {
            ...recipient,
            cycleId: cycleMessage.cycleId,
            cycleName: cycleMessage.cycleName,
            number: recipient.telefono,
            status: result?.status || "failed",
            error: result?.error || "",
            sid: result?.sid || "",
          };

          if (logItem.status === "sent") {
            sent.push(logItem);
            setSentLogs((current) => [...current, logItem]);
          } else {
            failed.push(logItem);
            setFailedLogs((current) => [...current, logItem]);
          }
        } catch (error) {
          const logItem = {
            ...recipient,
            cycleId: cycleMessage.cycleId,
            cycleName: cycleMessage.cycleName,
            number: recipient.telefono,
            status: "failed",
            error: error.message || "Error de conexion con el backend.",
          };
          failed.push(logItem);
          setFailedLogs((current) => [...current, logItem]);
        }

        setProgress({ current: processed, total: totalSends });
      }
    }

    setSendState("done");

    if (!cancelRef.current && totalSends > 0 && failed.length === 0) {
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 3800);
    }
  }

  function handleMultiCycleChange(enabled) {
    setMultiCycleEnabled(enabled);

    if (!enabled) {
      setSelectedCycleIds([activeCycleId]);
    }
  }

  function handleCycleSelect(cycleId) {
    const cycle = cycles[cycleId];
    if (!cycle || cycle.pendiente) return;

    if (!multiCycleEnabled) {
      setActiveCycleId(cycleId);
      setSelectedCycleIds([cycleId]);
      return;
    }

    const isSelected = selectedCycleIds.includes(cycleId);

    if (isSelected && activeCycleId !== cycleId) {
      setActiveCycleId(cycleId);
      return;
    }

    if (isSelected && selectedCycleIds.length > 1) {
      const nextSelection = selectedCycleIds.filter((id) => id !== cycleId);
      setSelectedCycleIds(nextSelection);
      setActiveCycleId(nextSelection[0]);
      return;
    }

    if (!isSelected) {
      setSelectedCycleIds([...selectedCycleIds, cycleId]);
    }

    setActiveCycleId(cycleId);
  }

  function handleCycleSave(cycleId, updates) {
    setCycles((currentCycles) => ({
      ...currentCycles,
      [cycleId]: {
        ...currentCycles[cycleId],
        ...updates,
      },
    }));
  }

  const messageTooLong =
    !isConsolidado &&
    selectedMessages.some((cycleMessage) => cycleMessage.message.length > SMS_LIMIT);
  const canSend =
    parseState === "done" &&
    stats.validos > 0 &&
    (isConsolidado || selectedMessages.length > 0) &&
    !messageTooLong &&
    sendState !== "loading";

  return (
    <main className="app-shell">
      {showConfetti && <Confetti />}

      <header className="app-header">
        <div>
          <p className="eyebrow">Acueducto La Acuarela</p>
          <h1>Acuarela SMS</h1>
        </div>
        <span className="internal-badge">Sistema interno</span>
      </header>

      <section className="workspace">
        <div className="left-column">
          <FileUploader
            fileName={fileName}
            status={parseState}
            error={parseError}
            stats={stats}
            onFileSelect={handleFileSelect}
          />

          {isConsolidado ? (
            <ConsolidatedSummary data={excelData} />
          ) : (
            <CycleSelector
              cycles={cycles}
              activeCycleId={activeCycleId}
              selectedCycleIds={selectedCycleIds}
              multiCycleEnabled={multiCycleEnabled}
              onMultiCycleChange={handleMultiCycleChange}
              onSelect={handleCycleSelect}
              onSaveCycle={handleCycleSave}
            />
          )}

          <MessagePreview
            messages={previewMessages}
            limit={SMS_LIMIT}
            stats={stats}
            unitLabel={isConsolidado ? "ejemplos" : "ciclos"}
            note={
              isConsolidado
                ? `Mensaje personalizado por fila. Se muestran ${previewMessages.length} de ${stats.validos}.`
                : ""
            }
          />

          <SendButton
            canSend={canSend}
            disabledReason={
              messageTooLong
                ? "El SMS supera 160 caracteres."
                : isConsolidado
                  ? "Carga un Excel con numeros validos."
                  : "Carga un Excel con numeros validos y selecciona al menos un ciclo."
            }
            status={sendState}
            count={stats.validos}
            cycleCount={isConsolidado ? 1 : selectedMessages.length}
            cycleName={
              isConsolidado
                ? "mensaje personalizado"
                : selectedMessages[0]?.cycleName || activeCycle.name
            }
            totalMessages={
              isConsolidado ? stats.validos : stats.validos * selectedMessages.length
            }
            personalizado={isConsolidado}
            onConfirm={sendAllSms}
            onCancel={cancelSend}
          />
        </div>

        <LogPanel
          sent={sentLogs}
          failed={failedLogs}
          skipped={excelData.invalidos}
          progress={progress}
          status={sendState}
        />
      </section>
    </main>
  );
}

function ConsolidatedSummary({ data }) {
  const extras = Math.max(0, data.segmentos - data.validos.length);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Archivo consolidado</p>
          <h2>Mensaje por destinatario</h2>
        </div>
      </div>

      <div className="cycle-detail">
        <div className="cycle-row">
          <span>Hoja</span>
          <strong>{data.hoja}</strong>
        </div>
        <div className="cycle-row">
          <span>Segmentos a facturar</span>
          <strong>{data.segmentos}</strong>
        </div>
        <div className="cycle-row">
          <span>Celulares repetidos</span>
          <strong>{data.duplicados.length}</strong>
        </div>
      </div>

      {extras > 0 && (
        <p className="send-hint">
          {extras} segmento(s) extra por tildes fuera de GSM-7. La app ya las
          normaliza automaticamente antes de enviar.
        </p>
      )}

      {data.duplicados.length > 0 && (
        <p className="form-error">
          Hay {data.duplicados.length} celular(es) repetidos: esas personas
          recibiran mas de un SMS.
        </p>
      )}
    </section>
  );
}

function Confetti() {
  return (
    <div className="confetti-layer" aria-hidden="true">
      {Array.from({ length: 20 }).map((_, index) => (
        <span key={index} style={{ "--i": index }} />
      ))}
    </div>
  );
}
