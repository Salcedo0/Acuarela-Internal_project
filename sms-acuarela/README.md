# Acuarela SMS

Aplicacion web standalone para procesar archivos Excel y enviar SMS masivos de cobro del Acueducto La Acuarela.

## Instalacion y ejecucion

```bash
# Backend
cd backend
npm install
# Crear .env con tus credenciales de Twilio
cp .env.example .env
node server.js

# Frontend (en otra terminal)
npm install
npm run dev
```

## Build de produccion

La URL del backend se define al compilar:

```bash
VITE_SEND_ENDPOINT="https://TU-BACKEND/send-sms" npm run build
```

Si no se define, la app apunta a `http://localhost:3001/send-sms` (solo desarrollo).
Recuerda agregar el dominio del frontend al arreglo `origin` de CORS en `backend/server.js`.

## Archivo Excel

La app detecta el formato automaticamente leyendo la primera hoja.

### Formato consolidado (recomendado)

Un mensaje ya redactado por fila, agrupado por persona:

- `celular` — 10 digitos empezando en 3
- `mensaje_sms` — texto final del SMS, maximo 160 caracteres
- `nombre`, `codigos_suscriptor`, `cantidad_codigos` — opcionales, solo informativos

Cada destinatario recibe el texto de su propia fila. Como el archivo viene agrupado
por persona, quien tiene varios servicios recibe un unico SMS.

### Formato clasico

Un mismo mensaje para todos, armado desde el ciclo seleccionado en la interfaz:

- `TELEFONO`
- `NUMERO DE CEDULA`
- `APELLIDO 2`
- `DIRECCION`
- `NUMERO DE MEDIDOR`

### Reglas comunes

Los celulares colombianos se normalizan a formato E.164 (`+57XXXXXXXXXX`). Los telefonos
fijos de 7 digitos se marcan como no enviados.

Las tildes que rompen GSM-7 (`á`, `í`, `ó`, `ú`) se normalizan antes de enviar: sin eso
el SMS pasa a UCS-2, donde el tope baja de 160 a 70 caracteres y un mensaje normal se
parte en 2 o 3 segmentos facturables. Las que si son GSM-7 (`ñ`, `é`, `ü`) se conservan.

## Auditar un Excel sin enviar nada

```bash
npm run check -- "C:/ruta/al/archivo.xlsx"
```

Reporta filas validas e invalidas, celulares duplicados, segmentos a facturar y
cuantas peticiones tomara el envio. Sale con codigo 1 si algo no cuadra.

## Envio masivo

El frontend divide el envio en lotes de 50 y el backend acepta maximo 200 por peticion.
Mandar miles de SMS en una sola peticion HTTP muere por timeout del proxy.

Twilio entrega aproximadamente 1 SMS por segundo desde un numero long code, asi que un
envio de ~3000 mensajes toma cerca de una hora en entregarse aunque la API los acepte antes.

## Seguridad

Las credenciales de Twilio solo se leen desde `backend/.env`. El frontend no recibe ni expone `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` ni `TWILIO_PHONE_NUMBER`.
