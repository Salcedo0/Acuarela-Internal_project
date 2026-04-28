const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const twilio = require("twilio");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SMS_LIMIT = 160;

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
app.use(express.json({ limit: "1mb" }));

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
  });
});

// Body: { numbers: ["+573112139148"], message: "texto del SMS" }
app.post("/send-sms", async (req, res) => {
  const { numbers, message } = req.body || {};

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({
      error: "Debe enviar un arreglo de numeros en el campo numbers.",
    });
  }

  if (typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({
      error: "Debe enviar el texto del SMS en el campo message.",
    });
  }

  if (message.length > SMS_LIMIT) {
    return res.status(400).json({
      error: `El SMS tiene ${message.length} caracteres y supera el limite de ${SMS_LIMIT}.`,
    });
  }

  const results = [];

  for (const number of numbers) {
    if (!validateE164Colombia(number)) {
      results.push({
        number,
        status: "failed",
        error: "Numero E.164 invalido para Colombia",
      });
      await delay(100);
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

      results.push({
        number,
        status: "sent",
        sid: twilioMessage.sid,
      });
    } catch (error) {
      results.push({
        number,
        status: "failed",
        error: publicError(error),
      });
    }

    // Pausa simple para no saturar Twilio ni disparar envios masivos simultaneos.
    await delay(100);
  }

  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`Acuarela SMS backend escuchando en http://localhost:${PORT}`);
  if (!hasTwilioConfig) {
    console.warn("Twilio no esta configurado. Completa backend/.env antes de enviar SMS reales.");
  }
});
