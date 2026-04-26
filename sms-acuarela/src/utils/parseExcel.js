import * as XLSX from "xlsx";
import { formatToE164 } from "./formatPhone";

export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        const validos = [];
        const invalidos = [];

        rows.forEach((row, i) => {
          const tel = formatToE164(row["TELEFONO"]);
          const entry = {
            fila: i + 2,
            cedula: row["NUMERO DE CEDULA"],
            apellido: row["APELLIDO 2"],
            direccion: row["DIRECCION"],
            medidor: row["NUMERO DE MEDIDOR"],
            telefonoOriginal: row["TELEFONO"],
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

        resolve({ validos, invalidos, total: rows.length });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(file);
  });
}
