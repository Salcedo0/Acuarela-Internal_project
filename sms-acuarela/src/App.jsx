import { useMemo, useState } from "react";
import FileUploader from "./components/FileUploader.jsx";
import CycleSelector from "./components/CycleSelector.jsx";
import MessagePreview from "./components/MessagePreview.jsx";
import SendButton from "./components/SendButton.jsx";
import LogPanel from "./components/LogPanel.jsx";
import { CYCLES } from "./constants/cycles.js";
import { parseExcel } from "./utils/parseExcel.js";
import { buildSmsMessage, SMS_LIMIT } from "./utils/message.js";

const SEND_ENDPOINT = "http://localhost:3001/send-sms";

const emptyData = {
  validos: [],
  invalidos: [],
  total: 0,
};

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

  const activeCycle = cycles[activeCycleId];
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

  async function sendAllSms() {
    const recipients = excelData.validos;
    const messagesToSend = selectedMessages;
    const totalSends = recipients.length * messagesToSend.length;
    let processed = 0;

    setSendState("loading");
    setSentLogs([]);
    setFailedLogs([]);
    setProgress({ current: 0, total: totalSends });
    setShowConfetti(false);

    const sent = [];
    const failed = [];

    for (const cycleMessage of messagesToSend) {
      for (const recipient of recipients) {
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

    if (totalSends > 0 && failed.length === 0) {
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

  const messageTooLong = selectedMessages.some(
    (cycleMessage) => cycleMessage.message.length > SMS_LIMIT
  );
  const canSend =
    parseState === "done" &&
    stats.validos > 0 &&
    selectedMessages.length > 0 &&
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

          <CycleSelector
            cycles={cycles}
            activeCycleId={activeCycleId}
            selectedCycleIds={selectedCycleIds}
            multiCycleEnabled={multiCycleEnabled}
            onMultiCycleChange={handleMultiCycleChange}
            onSelect={handleCycleSelect}
            onSaveCycle={handleCycleSave}
          />

          <MessagePreview
            messages={selectedMessages}
            limit={SMS_LIMIT}
            stats={stats}
          />

          <SendButton
            canSend={canSend}
            disabledReason={
              messageTooLong
                ? "El SMS supera 160 caracteres."
                : "Carga un Excel con numeros validos y selecciona al menos un ciclo."
            }
            status={sendState}
            count={stats.validos}
            cycleCount={selectedMessages.length}
            cycleName={selectedMessages[0]?.cycleName || activeCycle.name}
            totalMessages={stats.validos * selectedMessages.length}
            onConfirm={sendAllSms}
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

function Confetti() {
  return (
    <div className="confetti-layer" aria-hidden="true">
      {Array.from({ length: 20 }).map((_, index) => (
        <span key={index} style={{ "--i": index }} />
      ))}
    </div>
  );
}
