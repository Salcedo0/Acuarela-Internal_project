export const SMS_LIMIT = 160;

const MONTHS = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

export function buildSmsMessage(cycle) {
  if (!cycle || cycle.pendiente) return "";

  const fechaMaxima = toShortDate(cycle.fechaMaxima);

  return `Acueducto La Acuarela: Pague antes de ${fechaMaxima} para evitar suspension. Pague aqui: https://acueductolaacuarela.com/pago-factura`;
}

function toShortDate(dateText) {
  const match = String(dateText || "").match(
    /(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/i
  );

  if (!match) return dateText;

  const [, day, monthName, year] = match;
  const month = MONTHS[monthName.toLowerCase()];

  if (!month) return dateText;

  return `${day.padStart(2, "0")}/${month}/${year}`;
}
