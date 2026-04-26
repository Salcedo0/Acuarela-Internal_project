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

## Archivo Excel

La primera hoja debe incluir estas columnas:

- `TELEFONO`
- `NUMERO DE CEDULA`
- `APELLIDO 2`
- `DIRECCION`
- `NUMERO DE MEDIDOR`

Los celulares colombianos se normalizan a formato E.164 (`+57XXXXXXXXXX`). Los telefonos fijos de 7 digitos se marcan como no enviados.

## Seguridad

Las credenciales de Twilio solo se leen desde `backend/.env`. El frontend no recibe ni expone `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` ni `TWILIO_PHONE_NUMBER`.
