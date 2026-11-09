# Snap API

Base URL local: `http://localhost:3000`. Las rutas protegidas exigen `Authorization: Bearer <jwt>`
(el token se obtiene en `/auth/register` o `/auth/login`).

Los errores tienen siempre la forma:

```json
{ "error": { "code": "bad_request", "message": "days debe ser un entero" } }
```

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | No | Estado del servicio |
| POST | `/auth/register` | No | Crea un usuario |
| POST | `/auth/login` | No | Inicia sesión |
| POST | `/api/urls` | Sí | Acorta una URL |
| GET | `/api/urls` | No | Lista las URLs |
| DELETE | `/api/urls/:code` | Sí | Borra una URL propia |
| GET | `/api/dashboard` | Sí | Resumen de URLs y clicks del usuario |
| GET | `/:code` | No | Redirige (302) y registra el click |

## GET /api/dashboard

Vista general de las URLs del usuario autenticado y su rendimiento. Solo se cuentan las URLs
y clicks del propio usuario.

### Query params

| Param | Tipo | Defecto | Descripción |
|---|---|---|---|
| `days` | entero 1–90 | `30` | Longitud en días del periodo de tendencias |

### Respuesta 200

```json
{
  "period": { "days": 30, "from": "2026-10-11", "to": "2026-11-09", "timezone": "UTC" },
  "totals": { "urls": 12, "clicks": 340, "avgClicksPerUrl": 28.33, "urlsWithoutClicks": 2 },
  "trends": {
    "clicksByDay": [
      { "date": "2026-10-11", "clicks": 0 },
      { "date": "2026-10-12", "clicks": 14 }
    ],
    "comparison": { "current": 90, "previous": 60, "changePct": 50 }
  }
}
```

| Campo | Descripción |
|---|---|
| `period` | Periodo de las tendencias. `from` y `to` son días UTC, ambos incluidos. |
| `totals.urls` | URLs del usuario. |
| `totals.clicks` | Clicks de **todo el historial**, no solo del periodo. |
| `totals.avgClicksPerUrl` | `clicks / urls`, redondeado a 2 decimales (0 si no hay URLs). |
| `totals.urlsWithoutClicks` | URLs sin ningún click en todo el historial. |
| `trends.clicksByDay` | Exactamente `days` elementos en orden ascendente; los días sin clicks llevan `0`. |
| `trends.comparison.current` | Clicks del periodo actual (los últimos `days` días, incluido hoy). |
| `trends.comparison.previous` | Clicks de los `days` días inmediatamente anteriores. |
| `trends.comparison.changePct` | `(current - previous) / previous * 100`, 2 decimales. `null` si `previous` es 0. |

### Errores

| Estado | Cuándo |
|---|---|
| 400 | `days` no es un entero o está fuera de 1–90 |
| 401 | Falta el token, el formato es inválido o el token es inválido/expirado |

### Ejemplo

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/dashboard?days=7"
```

### Notas

- Todas las fechas son UTC. No hay parámetro de zona horaria.
- Los clicks se registran desde que existe la tabla `clicks`; no hay histórico anterior.
- Cada click guarda `url_id`, la fecha y el `user_agent` (máx. 512 caracteres). Los bots y
  previsualizadores de enlaces se cuentan igual que cualquier otro click.
- Si se borra una URL, sus clicks se borran en cascada.

## GET /:code

Redirige con `302` a la URL original y registra un click. Responde `404` si el código no existe.
Un fallo al registrar el click no impide la redirección.

## Otros endpoints

- `POST /auth/register` — body `{ email, password, name }`; `201` con token y usuario.
  `400` si es inválido, `409` si el email ya existe.
- `POST /auth/login` — body `{ email, password }`; `200` con token y usuario. `401` si las credenciales son erróneas.
- `POST /api/urls` — body `{ url }` (solo `http`/`https`); `201` con el registro y `shortUrl`.
- `GET /api/urls` — lista todas las URLs de todos los usuarios, sin autenticación.
- `DELETE /api/urls/:code` — `204`; `403` si la URL es de otro usuario, `404` si no existe.
