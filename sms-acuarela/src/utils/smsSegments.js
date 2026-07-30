// GSM 03.38: alfabeto que Twilio cobra a 160 caracteres por segmento.
// Ojo: "e" y "n" con tilde/virgulilla (é, ñ) SI estan; á, í, ó, ú NO.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const COMBINING_MARKS = new RegExp("[\u0300-\u036f]", "g");
const GSM_EXT = "^{}\\[~]|€";

export function isGsm7(text) {
  return [...String(text || "")].every(
    (char) => GSM_BASIC.includes(char) || GSM_EXT.includes(char)
  );
}

// Caracteres que sacan el mensaje de GSM-7 y lo obligan a UCS-2 (tope 70).
export function nonGsmChars(text) {
  return [
    ...new Set(
      [...String(text || "")].filter(
        (char) => !GSM_BASIC.includes(char) && !GSM_EXT.includes(char)
      )
    ),
  ];
}

export function countSegments(text) {
  const value = String(text || "");
  if (value.length === 0) return 0;

  if (isGsm7(value)) {
    const length = [...value].reduce(
      (total, char) => total + (GSM_EXT.includes(char) ? 2 : 1),
      0
    );
    return length <= 160 ? 1 : Math.ceil(length / 153);
  }

  const length = [...value].length;
  return length <= 70 ? 1 : Math.ceil(length / 67);
}

// Quita SOLO las tildes que rompen GSM-7 (á, í, ó, ú...).
// Deja intactas las que si son GSM-7, para no convertir Munoz en Munoz ni Jose en Jose
// cuando el original ya era valido: ñ, é, ü, à, ç se conservan tal cual.
export function toGsm7Safe(text) {
  return [...String(text || "")]
    .map((char) => {
      if (GSM_BASIC.includes(char) || GSM_EXT.includes(char)) return char;

      const stripped = char
        .normalize("NFD")
        .replace(COMBINING_MARKS, "")
        .normalize("NFC");

      return GSM_BASIC.includes(stripped) ? stripped : char;
    })
    .join("");
}
