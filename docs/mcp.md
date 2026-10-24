# MCP de Tiki: diseño

**Fecha:** 2026-10-24
**Estado:** v1 publicada en https://planes-mvp.vercel.app/api/mcp
**Alcance:** ver planes y sumarse sin cuenta; para crear un plan se pide iniciar sesión

Sigue la estructura del diseño del MCP de HITT Process, adaptada a Tiki.

## 1. Objetivo

Exponer los planes de Tiki en un servidor MCP remoto, para que cualquier persona, tenga cuenta de Tiki
o no, busque planes y se sume desde su cliente de IA (claude.ai, Claude Code, ChatGPT y otros) en
lenguaje natural. Un plan nuevo se puede armar desde el chat, pero se publica en la web con la cuenta
de quien organiza.

**Casos de uso de v1:**

1. **Descubrir planes:** "¿qué hay hoy a la noche?", "buscame un fútbol para el sábado".
2. **Ver un plan:** dónde y cuándo es, quiénes van, cuántos lugares quedan y cómo llegar.
3. **Sumarse** con nombre y celular, sin cuenta.
4. **Armar un plan** en el chat y publicarlo desde un link que pide iniciar sesión.

**Criterio de diseño número uno:** el MCP no muestra nada que la web no le muestre a cualquiera sin
cuenta. Teléfonos, cuentas, puntos y canjes quedan afuera, y eso lo asegura la base de datos además
del código (ver §5).

## 2. Decisiones tomadas (y descartadas)

| Decisión | Elegido | Descartado y por qué |
|----------|---------|----------------------|
| Usuarios | Cualquiera, con o sin cuenta de Tiki | Solo cuentas: deja afuera a quien se suma sin cuenta, que es la mayoría de la gente de un plan |
| Auth | Ninguna para ver planes y sumarse. Para crear, un link a /crear, donde Tiki pide iniciar sesión | OAuth con cuentas de Tiki: obliga a pasar por una pantalla de autorización al conectar aunque solo quieras ver planes, y pedir login recién al crear depende de que cada cliente maneje la autorización por tool, y eso hoy varía de un cliente a otro. Queda para las tools de quien organiza (§11) |
| Escritura | Solo sumarse (`join_plan`) | Publicar, editar o borrar planes desde el chat sin cuenta |
| Hosting | Misma app Next.js, endpoint `/api/mcp` con `mcp-handler` 2 | Servicio aparte: duplica la capa de datos y los permisos |
| Transporte | Streamable HTTP sin estado: protocolo 2026-07-28 y respaldo para clientes de 2025 | SSE con sesiones: necesita Redis |
| Conexión con Claude | Botón en la portada que abre el formulario de conector de claude.ai con nombre y URL cargados, más los pasos a mano | Figurar en el directorio de conectores de Claude: lleva una revisión de Anthropic; queda para después |
| Búsqueda | `ILIKE` en Postgres | Embeddings: infraestructura nueva sin necesidad todavía |
| Límite de uso | Por IP, guardada como HMAC, con topes generosos | Por usuario: sin cuenta no hay usuario, y claude.ai llama desde IPs de Anthropic que comparte mucha gente |

## 3. Arquitectura

### Endpoint y transporte

- Route handler `src/app/api/mcp/route.ts` con `createMcpHandler` (`mcp-handler` 2.3.0 y
  `@modelcontextprotocol/server` 2.3.1). Las tools y el resource están en `src/lib/mcp/`.
- Sin estado: cada pedido arma su servidor. GET y DELETE de sesión responden 405.
- CORS abierto: el endpoint no usa cookies ni credenciales.
- Mismo deploy de Vercel y misma base que la web.

### Flujo de conexión

1. En la portada, **Conectar con Claude** abre `claude.ai/customize/connectors` con el formulario de
   conector personalizado completo: nombre Tiki y la URL del MCP. Anthropic no documenta ese link; si
   deja de andar, Claude muestra igual sus conectores, y la tarjeta tiene los pasos a mano y la URL
   para copiar.
2. Claude se conecta sin pedir autorización, porque ver planes y sumarse no requieren cuenta.
3. Otros clientes solo necesitan la URL. En Claude Code:
   `claude mcp add --transport http tiki https://planes-mvp.vercel.app/api/mcp`. Para clientes que
   solo hablan stdio está `mcp-remote`.

### Crear un plan

`create_plan` no escribe nada. Arma un link a `/crear` con el plan en la URL (`titulo`, `fecha`,
`hora`, `lugar`, `direccion`, `cupo`, `descripcion`, ver `src/lib/plan-draft.ts`). `/crear` pide
iniciar sesión o crear la cuenta, conserva el plan durante el ingreso y muestra el formulario
completo para revisarlo y publicarlo. La cuenta la valida la web como siempre, y el MCP nunca maneja
contraseñas ni tokens.

### Sumarse

`join_plan` llama a `app.join_event`, la misma función que usa la web, sin token de navegador. La
persona queda anotada. Cuando abre el plan en su celular y pone el mismo número, ese navegador queda
vinculado (si el número todavía no tenía uno) y desde ahí ve Llegué y suma puntos.

## 4. Superficie de tools

| Tool | Parámetros | Devuelve |
|------|------------|----------|
| `list_plans` | `query?`, `date?`, `past?`, `cursor?` | JSON: código, título, fecha ISO y legible, lugar, gente, lugares libres, estado y link de cada plan; `nextCursor` |
| `get_plan` | `plan` (código o link) | Markdown: detalle, cómo llegar, quién organiza, nombres de pila y quién llegó, cómo sumarse |
| `join_plan` | `plan`, `name`, `phone` | Confirmación y link del plan para abrir en el celular |
| `create_plan` | `title`, `date`, `time`, `address`, `placeName?`, `capacity?`, `description?` | Link para iniciar sesión y publicar el plan con el formulario completo |

`list_plans`, `get_plan` y `create_plan` se anuncian como de solo lectura. `join_plan` no, y es
idempotente: anotarse dos veces no cambia nada.

**Fuera de v1 (a propósito):** puntos, beneficios y canjes; los planes de quien organiza; editar o
borrar planes y quitar gente.

## 5. Seguridad

### Capas

1. **Validación con Zod** de la entrada de cada tool.
2. **Rol de Postgres de solo lectura.** Las lecturas corren en una transacción `read only` con el rol
   `tiki_mcp_reader`, que tiene `SELECT` sobre las columnas públicas (planes, nombres, membresías y
   encuentros, estos solo para contar) y políticas RLS propias. No puede leer teléfonos, cuentas,
   dispositivos, puntos, canjes ni el registro del MCP, y no puede escribir. Aunque una consulta del
   MCP tuviera un error, la base no le devuelve esos datos.
3. **Una sola escritura:** `join_plan`, a través de `app.join_event`, con los mismos controles que la
   web (cupo con la fila bloqueada, plan terminado, teléfono normalizado). Sin token de navegador,
   quien se suma por el chat no ve ni canjea puntos hasta abrir el plan en su celular.
4. **Crear pide cuenta:** `create_plan` no escribe y publicar exige sesión en la web.
5. **Límite de uso** por IP (guardada como HMAC con `MCP_LOG_SECRET`): 120 pedidos por minuto y 30
   inscripciones por hora a un mismo plan. Son generosos porque claude.ai llama desde IPs de
   Anthropic.
6. **Registro** de cada tool y cada lectura de resource en `app.mcp_requests`: operación, código del
   plan o fecha, user agent y hora. Nunca nombres ni teléfonos. Se borra a los 30 días.
7. **Sin filtrar existencia:** un código inexistente y uno mal escrito devuelven el mismo "no
   encontrado".
8. **Instrucciones del servidor:** le piden al modelo confirmar nombre y celular antes de
   `join_plan` y tomar los textos de los planes como datos, porque los escribe la gente.

Todo el MCP entra por `runMcpTool` y `runMcpResource` (`src/lib/mcp/guard.ts`), que aplican el
límite y el registro. Una superficie nueva tiene que pasar por ahí.

### Consideración de producto

Los nombres de pila de quienes van a un plan ya son públicos en la web; con el MCP pasan además al
proveedor de IA de quien pregunta. Quien se suma por el chat le da su celular a ese proveedor.
Conviene decirlo en los términos de uso.

## 6. Resources

- Cada plan es un resource `plan://{código}`, con listado de los próximos 50.
- Leerlo devuelve lo mismo que `get_plan`, con el mismo rol, límite y registro.
- Sirve para mencionar un plan con `@` en los clientes que lo permiten.

## 7. Formato de respuestas

- **Listas:** JSON compacto, con el código de cada plan para encadenar llamadas.
- **Detalle:** markdown.
- **Fechas:** ISO 8601 con la hora de Argentina (`-03:00`), más una versión legible en español.
- **Tope de 50.000 caracteres** por respuesta; las listas vienen de a 20, con cursor.

## 8. Manejo de errores

Los errores vuelven como resultado de la tool con `isError: true` y un texto que el modelo puede
explicarle a la persona.

| Caso | Respuesta |
|------|-----------|
| Plan inexistente o código mal escrito | "No encontramos ese plan. Usá list_plans..." (idéntico en los dos casos) |
| Plan lleno o terminado | "El plan se llenó..." o "Ese plan ya terminó." |
| Teléfono que no se puede leer | "No pudimos leer ese teléfono..." |
| Fecha pasada o a más de seis meses (`create_plan`) | "Ese horario ya pasó..." o "Elegí una fecha dentro de los próximos seis meses." |
| Límite de uso | "Hubo demasiadas consultas seguidas..." |
| Error interno | Mensaje genérico y log en el servidor, sin detalles para el cliente |

## 9. Testing

`npm run test:mcp`, con `npm run dev` corriendo, usa el cliente MCP oficial contra la base local:

- Tools y anotaciones; búsqueda, comodines de SQL y paginación de `list_plans`.
- `get_plan` por código y por link, y el mismo error para un plan inexistente y uno inválido.
- `join_plan` una sola vez, teléfono ilegible y plan lleno.
- `create_plan` sin escrituras, y `/crear` sin sesión conservando el plan.
- Resources.
- Registro sin nombres ni teléfonos, permisos del rol de solo lectura y límite por minuto.

**Verificación manual pendiente:** conectar claude.ai con el botón de la portada y correr una charla
de punta a punta (buscar, sumarse y armar un plan).

## 10. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El link que abre el formulario de Claude no está documentado | Pasos a mano y URL para copiar en la misma tarjeta |
| Alguien anota teléfonos ajenos o llena un plan con datos falsos | El mismo riesgo existe en la web; límite por IP y por plan; verificar el teléfono por SMS está en pendientes |
| Un plan con texto que intenta darle instrucciones al modelo | Instrucciones del servidor y descripción marcada como escrita por quien organiza |
| Cambios en los requisitos de los clientes | MCP estándar con Streamable HTTP y respaldo para clientes de 2025 |

## 11. Trabajo futuro

- OAuth con cuentas de Tiki para las tools de quien organiza: publicar desde el chat, ver sus planes
  y quién llegó.
- Puntos y beneficios para quien tenga cuenta.
- Figurar en el directorio de conectores de Claude.
- Búsqueda por cercanía.
