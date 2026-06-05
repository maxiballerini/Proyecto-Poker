# Poker Nights — Arquitectura / Spec

<!-- Nombre de trabajo "PokerNights": cambialo por el que quieras. -->
<!-- Este doc NO se carga al inicio de sesión. Claude Code lo lee cuando construye features. -->

## Qué es
App web para gestionar partidas de poker en vivo (home games). Dos módulos:
1. **Cash** — gestor de partidas estilo "Splitwise de poker".
2. **MTT** — manager de torneos con reloj.

MVP pensado para usar con amigos, con la arquitectura lista para escalar a producto.

## Stack
- **Backend:** FastAPI (Python)
- **DB + Auth:** Supabase (PostgreSQL, Row Level Security, Supabase Auth)
- **Frontend:** React + Vite + Tailwind
- **Realtime:** Supabase Realtime (reloj del MTT en modo TV + actualización de saldos en vivo)
- **Moneda:** ARS (pesos). Montos guardados como enteros (centavos) para evitar errores de float.

## Roles y acceso
- **Host:** crea y gestiona sesiones, carga buy-ins / re-buys / cash-outs, configura torneos y el reloj. Permiso de escritura.
- **Jugador:** cuenta propia con acceso de **lectura** a sus resultados. Ve cuánto debe, a quién, y el **alias de transferencia** del acreedor. Cada usuario guarda su propio alias (CBU/CVU/alias bancario) en su perfil.
- **RLS:** cada jugador solo ve sus propias filas y las sesiones donde participó. El host ve todo lo de sus sesiones.

---

## Módulo 1 — Cash (Splitwise de poker)

### Modelo de datos (orientativo)
- `profile`: user_id, nombre, alias_transferencia
- `cash_session`: id, fecha, lugar, host_id, moneda, estado (`abierta` | `cerrada`)
- `session_player`: session_id, player_id
- `buyin`: id, session_id, player_id, monto, created_at  *(varios por jugador = re-buys)*
- `cashout`: id, session_id, player_id, monto_final
- `settlement`: session_id, deudor_id, acreedor_id, monto, estado (`pendiente` | `pagado`)

### Lógica
- **Neto por jugador** = cash_out − Σ buy-ins. La suma de todos los netos debe dar ≈ 0.
- Al **cerrar** la sesión, calcular los netos y correr **simplificación de deudas (greedy, estilo Splitwise):** emparejar al mayor deudor con el mayor acreedor, saldar el mínimo de ambos, repetir. Minimiza la cantidad de transferencias.
- Output: lista de "X le transfiere $N a Y", mostrando el **alias de Y**.
- Cada jugador, en su cuenta, ve sus deudas pendientes + el alias para pagar, y puede marcar "pagado" (el host confirma).

### Historial / stats por jugador
- Total ganado/perdido, sesiones jugadas, mejor y peor sesión, racha.

---

## Módulo 2 — MTT (torneos)

### Setup
- `tournament`: id, nombre, fecha, buy_in, stack_inicial, host_id, permite_reentry (bool)
- `blind_level`: tournament_id, orden, small_blind, big_blind, ante, duracion_min, es_break (bool)
- `prize`: tournament_id, puesto, porcentaje (o monto)
- Pozo = (entradas + re-entries) × buy_in. Premios = pozo × porcentaje por puesto.

### Reloj
- Cuenta regresiva por nivel, **auto-avance** al siguiente, **alarma sonora** al cambiar de nivel.
- Controles del host: play/pausa, siguiente/anterior nivel, sumar/restar tiempo.
- **Modo pantalla/TV:** vista full-screen, tipografía grande. Muestra: nivel actual (SB/BB/ante), tiempo restante, próximo nivel, pozo, premios, jugadores restantes.
- **Sincronización en tiempo real** (Supabase Realtime): el host controla desde el celu y la TV refleja el estado al instante. El estado del reloj vive en la DB (`tournament_clock`: nivel_actual, segundos_restantes, corriendo) para que cualquier pantalla se sincronice.

### Gestión en vivo (MVP liviano)
- Contador de entradas / re-entries, jugadores restantes, stack promedio.

---

## Convenciones no negociables
- Validar rol **server-side** en TODA ruta de escritura. Nunca confiar en el front.
- RLS activado en todas las tablas, con políticas separadas para host y jugador.
- Montos en **enteros (centavos)**, nunca float.
- Nunca exponer el `service_role` key de Supabase en el frontend (solo el `anon` key).

## Fuera del MVP (para después)
- Pagos integrados (Mercado Pago), ICM en premios, multi-moneda, ligas/rankings entre sesiones, exportar resultados a PDF.
