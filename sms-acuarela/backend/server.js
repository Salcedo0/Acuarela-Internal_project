const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const twilio = require("twilio");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SMS_LIMIT = 160;
const MAX_BATCH = 200;
const SEND_DELAY_MS = Number(process.env.SEND_DELAY_MS || 100);

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
} = process.env;

const hasTwilioConfig = Boolean(
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER
);
const twilioClient = hasTwilioConfig
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

app.use(
  cors({
    origin: ['http://localhost:5173', 'https://acuarelasms.acueductolaacuarela.com']
  })
);
app.use(express.json({ limit: "2mb" }));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateE164Colombia(number) {
  return typeof number === "string" && /^\+57\d{10}$/.test(number);
}

function publicError(error) {
  if (!error) return "Error desconocido";
  return error.message || String(error);
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    twilioConfigured: hasTwilioConfig,
    maxBatch: MAX_BATCH,
  });
});

// Acepta dos formas:
//   1. Personalizado: { items: [{ number, message, ref }] }  -> un texto distinto por numero
//   2. Mensaje unico: { numbers: [...], message: "texto" }   -> compatibilidad con el flujo por ciclos
function normalizePayload(body) {
  const { items, numbers, message } = body || {};

  if (Array.isArray(items)) {
    if (items.length === 0) {
      return { error: "El arreglo items esta vacio." };
    }

    return {
      list: items.map((item) => ({
        number: item?.number,
        message: typeof item?.message === "string" ? item.message : "",
        ref: item?.ref ?? null,
      })),
    };
  }

  if (Array.isArray(numbers)) {
    if (numbers.length === 0) {
      return { error: "Debe enviar un arreglo de numeros en el campo numbers." };
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return { error: "Debe enviar el texto del SMS en el campo message." };
    }

    return { list: numbers.map((number) => ({ number, message, ref: null })) };
  }

  return {
    error: "Debe enviar items: [{number, message}] o numbers: [] junto con message.",
  };
}

app.post("/send-sms", async (req, res) => {
  const { list, error } = normalizePayload(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  if (list.length > MAX_BATCH) {
    return res.status(400).json({
      error: `El lote trae ${list.length} envios y supera el maximo de ${MAX_BATCH}. Divide el envio en lotes mas pequenos.`,
    });
  }

  const results = [];

  for (const { number, message, ref } of list) {
    if (!validateE164Colombia(number)) {
      results.push({
        number,
        ref,
        status: "failed",
        error: "Numero E.164 invalido para Colombia",
      });
      continue;
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      results.push({ number, ref, status: "failed", error: "Mensaje vacio" });
      continue;
    }

    if (message.length > SMS_LIMIT) {
      results.push({
        number,
        ref,
        status: "failed",
        error: `El SMS tiene ${message.length} caracteres y supera el limite de ${SMS_LIMIT}.`,
      });
      continue;
    }

    try {
      if (!twilioClient) {
        throw new Error("Credenciales de Twilio incompletas en backend/.env");
      }

      const twilioMessage = await twilioClient.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: number,
      });

      results.push({ number, ref, status: "sent", sid: twilioMessage.sid });
    } catch (err) {
      results.push({ number, ref, status: "failed", error: publicError(err) });
    }

    // Pausa simple para no saturar Twilio ni disparar envios masivos simultaneos.
    await delay(SEND_DELAY_MS);
  }

  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`Acuarela SMS backend escuchando en http://localhost:${PORT}`);
  if (!hasTwilioConfig) {
    console.warn("Twilio no esta configurado. Completa backend/.env antes de enviar SMS reales.");
  }
});
