# Llamadas MVP (Twilio + Laravel)

Este módulo agrega una base para llamadas de voz sin implementar SIP/RTP desde cero.

## Endpoints

Protegidos por `auth.api`:

- `POST /api/calls/token`
  - Genera token de voz para cliente (Twilio o mock)
  - Body opcional: `{ "identity": "user-123" }`

- `GET /api/calls/sessions?limit=30&status=completed`
  - Lista llamadas donde participa el usuario actual

- `POST /api/calls/sessions`
  - Crea sesión local de llamada
  - Body ejemplo:
    ```json
    {
      "target_user_id": 24,
      "channel": "client",
      "metadata": {"module": "soporte"}
    }
    ```
  - Para PSTN opcional: `channel=phone`, `to_phone`, `dial_now=true`, `from_phone`

- `PATCH /api/calls/sessions/{id}`
  - Actualiza estado (`initiated`, `ringing`, `answered`, `completed`, `failed`, `busy`, `no-answer`, `canceled`)

- `GET /api/calls/webrtc/config`
  - Devuelve configuración ICE (`stun/turn`) para WebRTC propio

- `GET /api/calls/sessions/{id}`
  - Obtiene detalle de sesión

- `POST /api/calls/sessions/{id}/webrtc/offer`
  - Publica SDP offer
  - Body: `{ "sdp": "..." }`

- `POST /api/calls/sessions/{id}/webrtc/answer`
  - Publica SDP answer
  - Body: `{ "sdp": "..." }`

- `POST /api/calls/sessions/{id}/webrtc/candidate`
  - Publica ICE candidate
  - Body: `{ "candidate": "...", "sdpMid": "0", "sdpMLineIndex": 0 }`

- `GET /api/calls/sessions/{id}/webrtc/sync?since=0`
  - Polling incremental de señalización (offer/answer/candidates/hangup)

- `POST /api/calls/sessions/{id}/hangup`
  - Cierra llamada y propaga evento hangup

Públicos (webhooks Twilio):

- `POST /api/voice/twilio/status`
  - Callback de estados de Twilio

- `GET|POST /api/voice/twilio/twiml/outbound`
  - Devuelve TwiML de marcado a `To`

## Variables de entorno

Agregar en `back/.env`:

```env
VOICE_DRIVER=mock
VOICE_TOKEN_TTL=3600
VOICE_WEBHOOK_SIGNATURE_VALIDATION=true
VOICE_DEFAULT_CALLER_ID=
WEBRTC_ENABLED=true
WEBRTC_ICE_SERVERS=stun:stun.l.google.com:19302
WEBRTC_TURN_USERNAME=
WEBRTC_TURN_CREDENTIAL=

TWILIO_ENABLED=false
TWILIO_ACCOUNT_SID=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
TWILIO_AUTH_TOKEN=
TWILIO_TWIML_APP_SID=
TWILIO_STATUS_CALLBACK_URL=
TWILIO_OUTBOUND_TWIML_URL=
TWILIO_SIGNATURE_URL=
```

Para activar Twilio real:

- `VOICE_DRIVER=twilio`
- `TWILIO_ENABLED=true`
- Completar `SID/KEY/SECRET/TOKEN`
- Configurar `TWILIO_STATUS_CALLBACK_URL` y `TWILIO_OUTBOUND_TWIML_URL` con URL pública HTTPS

## Flujo recomendado

1. App pide token (`/api/calls/token`).
2. App crea sesión local (`/api/calls/sessions`) con `channel=webrtc`.
3. Originador publica `offer`.
4. Destinatario consulta `sync`, responde con `answer` y ambos publican ICE candidates.
5. Ambos consultan `sync` hasta finalizar.
6. Al colgar, llamar `POST /api/calls/sessions/{id}/hangup`.

## Notas

- El modo `mock` permite desarrollar sin Twilio.
- Para producción, mantener validación de firma habilitada.
- Para WebRTC propio en redes móviles, se recomienda configurar TURN real en `WEBRTC_ICE_SERVERS`.
- Este MVP no incluye push entrante (APNs/FCM), grabación ni antifraude avanzado.
