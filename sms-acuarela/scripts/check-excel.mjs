// Audita un Excel con el MISMO parser que usa la app, sin enviar nada.
//   npm run check -- "C:/ruta/al/archivo.xlsx"
import fs from "node:fs";
import path from "node:path";
import { parseExcel, FORMATO_CONSOLIDADO } from "../src/utils/parseExcel.js";
import { countSegments, nonGsmChars } from "../src/utils/smsSegments.js";

const BATCH_SIZE = 50;

// El parser corre en el navegador; aca le damos un FileReader equivalente.
globalThis.FileReader = class {
  readAsBinaryString(file) {
    try {
      this.onload({
        target: { result: fs.readFileSync(file.path).toString("binary") },
      });
    } catch (error) {
      this.error = error;
      this.onerror?.();
    }
  }
};

const ruta = process.argv[2];

if (!ruta) {
  console.error('Uso: npm run check -- "C:/ruta/archivo.xlsx"');
  process.exit(1);
}

if (!fs.existsSync(ruta)) {
  console.error(`No existe el archivo: ${ruta}`);
  process.exit(1);
}

const r = await parseExcel({ path: ruta, name: path.basename(ruta) });
const consolidado = r.formato === FORMATO_CONSOLIDADO;

console.log(`\nArchivo : ${path.basename(ruta)}`);
console.log(`Hoja    : ${r.hoja}`);
console.log(`Formato : ${r.formato}${consolidado ? " (mensaje por fila)" : " (mensaje por ciclo)"}`);

console.log(`\nFilas leidas : ${r.total}`);
console.log(`Validos      : ${r.validos.length}`);
console.log(`Invalidos    : ${r.invalidos.length}`);

if (consolidado) {
  console.log(`Segmentos    : ${r.segmentos} (extra sobre 1 por SMS: ${r.segmentos - r.validos.length})`);
}

console.log(`Duplicados   : ${r.duplicados.length}`);
console.log(`Lotes        : ${Math.ceil(r.validos.length / BATCH_SIZE)} peticiones de ${BATCH_SIZE}`);

if (r.duplicados.length) {
  console.log("\nCelulares repetidos (recibirian varios SMS):");
  r.duplicados.slice(0, 10).forEach((d) => console.log(`  ${d.telefono} x${d.veces}`));
}

if (r.invalidos.length) {
  const porRazon = {};
  r.invalidos.forEach((row) => {
    porRazon[row.razon] = (porRazon[row.razon] || 0) + 1;
  });
  console.log("\nInvalidos por razon:");
  Object.entries(porRazon).forEach(([razon, n]) => console.log(`  ${n.toString().padStart(5)}  ${razon}`));
  console.log("\nPrimeros invalidos:");
  r.invalidos.slice(0, 10).forEach((row) =>
    console.log(`  fila ${row.fila}: [${row.telefonoOriginal ?? ""}] ${row.razon}`)
  );
}

if (consolidado) {
  const cambiados = r.validos.filter((row) => row.mensaje !== row.mensajeOriginal);
  console.log(`\nMensajes normalizados por tildes: ${cambiados.length}`);
  cambiados.slice(0, 5).forEach((row) => {
    const antes = countSegments(row.mensajeOriginal);
    console.log(`  fila ${row.fila}: ${antes} seg -> ${row.segmentos} seg`);
  });

  const pendientes = r.validos.filter((row) => nonGsmChars(row.mensaje).length > 0);
  if (pendientes.length) {
    console.log(`\nOJO: ${pendientes.length} mensaje(s) siguen fuera de GSM-7:`);
    pendientes.slice(0, 5).forEach((row) =>
      console.log(`  fila ${row.fila}: "${nonGsmChars(row.mensaje).join("")}"`)
    );
  }

  console.log("\nEjemplos listos para enviar:");
  r.validos.slice(0, 3).forEach((row) => {
    console.log(`  ${row.telefono} | ${row.nombre ?? ""}`);
    console.log(`    [${row.mensaje.length} chars / ${row.segmentos} seg] ${row.mensaje}`);
  });
}

const checks = [
  ["Numeros en formato +57XXXXXXXXXX", r.validos.every((x) => /^\+57\d{10}$/.test(x.telefono))],
  ["Mensajes <= 160 caracteres", !consolidado || r.validos.every((x) => x.mensaje.length <= 160)],
  ["Sin mensajes vacios", !consolidado || r.validos.every((x) => x.mensaje.trim().length > 0)],
  ["Sin celulares duplicados", r.duplicados.length === 0],
  ["Todos caben en 1 segmento", !consolidado || r.validos.every((x) => x.segmentos === 1)],
];

console.log("\nChequeos:");
let ok = true;
checks.forEach(([label, passed]) => {
  if (!passed) ok = false;
  console.log(`  ${passed ? "OK   " : "FALLA"} ${label}`);
});

console.log(
  ok
    ? `\nListo para enviar ${r.validos.length} SMS.\n`
    : `\nRevisa los puntos marcados antes de enviar.\n`
);

process.exit(ok ? 0 : 1);
