export function formatToE164(rawNumber) {
  if (!rawNumber) return null;

  let num = String(rawNumber).trim().replace(/[\s\-()./]/g, "");
  num = num.replace(/^\+/, "");

  // Ya tiene codigo de pais: 57 + 10 digitos
  if (num.startsWith("57") && num.length === 12) return `+${num}`;

  // Celular colombiano: 10 digitos empezando en 3
  if (num.length === 10 && num.startsWith("3")) return `+57${num}`;

  // Numero fijo de 7 digitos: no sirve para SMS, pero se clasifica aparte.
  if (num.length === 7) return { tipo: "fijo", original: rawNumber };

  return null;
}
