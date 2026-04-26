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
  const [selectedCycleId, setSelectedCycleId] = useState("1");
  const [fileName, setFileName] = useState("");
  const [excelData, setExcelData] = useState(emptyData);
  const [parseState, setParseState] = useState("idle");
  const [parseError, setParseError] = useState("");
  const [sentLogs, setSentLogs] = useState([]);
  const [failedLogs, setFailedLogs] = useState([]);
  const [sendState, setSendState] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showConfetti, setShowConfetti] = useState(false);

  const selectedCycle = cycles[selectedCycleId];
  const message = useMemo(() => buildSmsMessage(selectedCycle), [selectedCycle]);

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
    setSendState("loading");
    setSentLogs([]);
    setFailedLogs([]);
    setProgress({ current: 0, total: recipients.length });
    setShowConfetti(false);

    const sent = [];
    const failed = [];

    for (let index = 0; index < recipients.length; index += 1) {
      const recipient = recipients[index];

      try {
        const response = await fetch(SEND_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            numbers: [recipient.telefono],
            message,
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "El backend rechazo el envio.");
        }

        const result = payload.results?.[0];
        const logItem = {
          ...recipient,
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
          number: recipient.telefono,
          status: "failed",
          error: error.message || "Error de conexion con el backend.",
        };
        failed.push(logItem);
        setFailedLogs((current) => [...current, logItem]);
      }

      setProgress({ current: index + 1, total: recipients.length });
    }

    setSendState("done");

    if (recipients.length > 0 && failed.length === 0) {
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 3800);
    }
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

  const messageTooLong = message.length > SMS_LIMIT;
  const canSend =
    parseState === "done" &&
    stats.validos > 0 &&
    !selectedCycle.pendiente &&
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
            selectedCycleId={selectedCycleId}
            onSelect={setSelectedCycleId}
            onSaveCycle={handleCycleSave}
          />

          <MessagePreview message={message} limit={SMS_LIMIT} stats={stats} />

          <SendButton
            canSend={canSend}
            disabledReason={
              messageTooLong
                ? "El SMS supera 160 caracteres."
                : "Carga un Excel con numeros validos."
            }
            status={sendState}
            count={stats.validos}
            cycleName={selectedCycle.name}
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
