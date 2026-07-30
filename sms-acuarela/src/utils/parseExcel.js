import * as XLSX from "xlsx";
import { formatToE164 } from "./formatPhone.js";
import { countSegments, nonGsmChars, toGsm7Safe } from "./smsSegments.js";
import { SMS_LIMIT } from "./message.js";

export const FORMATO_CONSOLIDADO = "consolidado";
export const FORMATO_CLASICO = "clasico";

const COMBINING_MARKS = new RegExp("[\u0300-\u036f]", "g");

// Compara encabezados sin importar mayusculas, tildes ni espacios de mas.
function normalizeKey(key) {
  return String(key)
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildReader(row) {
  const map = {};
  Object.keys(row).forEach((key) => {
    map[normalizeKey(key)] = row[key];
  });

  return (...names) => {
    for (const name of names) {
      const value = map[normalizeKey(name)];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
    return undefined;
  };
}

function detectFormato(rows) {
  const keys = new Set(Object.keys(rows[0] || {}).map(normalizeKey));

  if (keys.has("celular") && keys.has("mensaje_sms")) return FORMATO_CONSOLIDADO;
  if (keys.has("telefono")) return FORMATO_CLASICO;

  // Si trae celular pero no mensaje_sms lo tratamos igual como consolidado,
  // asi el usuario ve el error real (filas sin mensaje) y no un "formato desconocido".
  if (keys.has("celular")) return FORMATO_CONSOLIDADO;

  return null;
}

function parseRows(rows, formato, { normalizarTildes }) {
  const validos = [];
  const invalidos = [];

  rows.forEach((row, index) => {
    const read = buildReader(row);
    const fila = index + 2;

    if (formato === FORMATO_CONSOLIDADO) {
      const rawTel = read("celular", "telefono");
      const tel = formatToE164(rawTel);
      const original = String(read("mensaje_sms", "mensaje") ?? "");
      const mensaje = normalizarTildes ? toGsm7Safe(original) : original;

      const entry = {
        fila,
        nombre: read("nombre"),
        codigos: read("codigos_suscriptor", "codigos"),
        cantidad: read("cantidad_codigos"),
        telefonoOriginal: rawTel,
        mensaje,
        mensajeOriginal: original,
        segmentos: countSegments(mensaje),
        // El log heredado espera estos dos campos.
        cedula: read("numero de cedula", "cedula"),
        direccion: read("direccion"),
      };

      if (typeof tel !== "string") {
        invalidos.push({
          ...entry,
          razon: tel?.tipo === "fijo" ? "Número fijo" : "Inválido/vacío",
        });
        return;
      }

      if (!mensaje.trim()) {
        invalidos.push({ ...entry, razon: "Sin mensaje" });
        return;
      }

      if (mensaje.length > SMS_LIMIT) {
        invalidos.push({
          ...entry,
          razon: `Mensaje de ${mensaje.length} caracteres (max ${SMS_LIMIT})`,
        });
        return;
      }

      validos.push({ ...entry, telefono: tel });
      return;
    }

    const rawTel = read("telefono");
    const tel = formatToE164(rawTel);
    const entry = {
      fila,
      cedula: read("numero de cedula"),
      apellido: read("apellido 2"),
      direccion: read("direccion"),
      medidor: read("numero de medidor"),
      telefonoOriginal: rawTel,
    };

    if (typeof tel === "string") {
      validos.push({ ...entry, telefono: tel });
    } else {
      invalidos.push({
        ...entry,
        razon: tel?.tipo === "fijo" ? "Número fijo" : "Inválido/vacío",
      });
    }
  });

  return { validos, invalidos };
}

export function parseExcel(file, options = {}) {
  const { normalizarTildes = true } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          throw new Error("La primera hoja del Excel esta vacia.");
        }

        const formato = detectFormato(rows);

        if (!formato) {
          const encontradas = Object.keys(rows[0] || {}).join(", ");
          throw new Error(
            `No se reconocen las columnas del Excel. Se encontro: ${encontradas}. ` +
              `Se espera "celular" + "mensaje_sms", o el formato clasico con "TELEFONO".`
          );
        }

        const { validos, invalidos } = parseRows(rows, formato, {
          normalizarTildes,
        });

        // Un mismo celular repetido significa SMS duplicados a la misma persona.
        const vistos = new Map();
        validos.forEach((row) => {
          vistos.set(row.telefono, (vistos.get(row.telefono) || 0) + 1);
        });
        const duplicados = [...vistos.entries()]
          .filter(([, veces]) => veces > 1)
          .map(([telefono, veces]) => ({ telefono, veces }));

        const segmentos = validos.reduce(
          (total, row) => total + (row.segmentos ?? 1),
          0
        );
        const conTildes = validos.filter(
          (row) => nonGsmChars(row.mensaje ?? "").length > 0
        ).length;

        resolve({
          validos,
          invalidos,
          total: rows.length,
          formato,
          hoja: wb.SheetNames[0],
          duplicados,
          segmentos,
          conTildes,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(file);
  });
}
