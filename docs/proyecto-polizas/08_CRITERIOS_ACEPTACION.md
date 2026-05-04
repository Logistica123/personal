# Criterios de Aceptación

> Checklist completo para validar que el módulo está listo para producción.
> Ejecutar al finalizar la implementación.

---

## A. Modelo de datos

- [ ] Las 7 tablas existen en la DB (`polizas_aseguradoras`, `polizas`, `polizas_email_config`, `polizas_endosos`, `polizas_asegurados`, `polizas_solicitudes`, `polizas_solicitud_asegurados`, `polizas_admin_permisos`).
- [ ] Tabla `archivos` tiene columna `categoria`.
- [ ] Seed insertó 3 aseguradoras + 4 pólizas + 8 email_configs.
- [ ] Las foreign keys funcionan (no se puede insertar `poliza_asegurado` con `poliza_id` inválido).
- [ ] Soft delete de póliza no borra registros relacionados.

```sql
SELECT COUNT(*) FROM polizas_aseguradoras;       -- = 3
SELECT COUNT(*) FROM polizas;                    -- = 4
SELECT COUNT(*) FROM polizas_email_config;       -- = 8
```

---

## B. Parser PDF — MAPFRE

- [ ] Subir `05_MAPFRE_CertEndoso_28.pdf` retorna `aseguradora_detectada = "MAPFRE"`.
- [ ] Parsea correctamente N° póliza `1520222860404`.
- [ ] Detecta vigencia `08/04/2025 → 08/04/2026`.
- [ ] Lista 88 asegurados con DU/CL.
- [ ] Cada asegurado tiene `tipo = persona` con `identificador_tipo` correcto (`dni` para DU, `cuil` para CL).
- [ ] Subir `04_MAPFRE_Endoso_28.pdf` retorna `tipo_documento = "endoso_modificacion"` (o `incorporacion`/`baja` según contenido).

---

## C. Parser PDF — San Cristóbal

- [ ] Subir `03_SanCristobal_FrenteEndoso_47.pdf` retorna `aseguradora_detectada = "SAN_CRISTOBAL"`.
- [ ] Parsea N° póliza `01-06-06-30035710`.
- [ ] Detecta `numero_endoso = "118"`.
- [ ] Detecta `tipo_documento = "endoso_incorporacion"`.
- [ ] Lista 3 asegurados (Yacob, Marolo, Lorences).
- [ ] Cada asegurado tiene `cuil`, `nombre_apellido`, `fecha_nacimiento`, `ocupacion`.
- [ ] CUIL normalizado: `20-31675826-7` se guarda como `20-31675826-7` y se compara con `20316758267`.

---

## D. Parser PDF — La Segunda Autos

- [ ] Subir `01_LaSegunda_Autos_*.pdf` retorna `aseguradora_detectada = "LA_SEGUNDA"`.
- [ ] Parsea N° póliza `67.743.063`.
- [ ] Detecta vigencia `23/01/2026 → 23/01/2027`.
- [ ] Lista todos los vehículos con `identificador_tipo = patente`.
- [ ] Cada vehículo tiene `marca_modelo`, `tipo_vehiculo` (CAMIONES, etc.), `año`, `localidad`.
- [ ] Patentes normalizadas (uppercase, sin espacios): `IWK373`, `AB393MN`, etc.
- [ ] Suma asegurada parseada como número (`53800000.00` no `"$53.800.000"`).

---

## E. Parser PDF — La Segunda Motos

- [ ] Subir `02_LaSegunda_Motos_*.pdf` retorna `aseguradora_detectada = "LA_SEGUNDA"`.
- [ ] Parsea N° póliza `45.597.407`.
- [ ] Todos los asegurados tienen `tipo_vehiculo = "MOTO"`.
- [ ] Vigencia `28/02/2026 → 31/05/2026`.

---

## F. Matching contra `personas`

- [ ] Match exacto por CUIL funciona (caso: Yacob CUIL `20316758267` debe matchear con `personas.cuil` si existe).
- [ ] Match por DNI extraído del CUIL funciona (caso: el CUIL `20-31675826-7` extrae DNI `31675826` y matchea).
- [ ] Match por patente funciona contra `personas.patente` y `persona_patentes.patente`.
- [ ] Fuzzy por nombre con score >= 0.85 retorna candidato.
- [ ] Score < 0.95 marca `revision_manual_pendiente = TRUE`.
- [ ] Sin match retorna `None` y el asegurado queda con `persona_id = NULL`, estado `no_matcheado`.

---

## G. Reportes de discrepancia

- [ ] `GET /api/polizas/{id}/discrepancias` devuelve los 3 arrays.
- [ ] `asegurados_sin_persona` lista solo los que no tienen `persona_id`.
- [ ] `personas_sin_poliza` lista solo personas activas (`estado = "Activo"`) que no figuran como asegurado activo en la póliza.
- [ ] `match_dudoso` lista solo los que tienen `revision_manual_pendiente = TRUE`.

---

## H. UI Pólizas

- [ ] `/polizas` muestra 4 cards (1 por póliza).
- [ ] Cada card muestra: aseguradora, nombre, N° póliza, vigencia, días para vencer, cantidad de asegurados, badge de discrepancias.
- [ ] Pólizas dentro de los 15 días de vencer tienen badge rojo.
- [ ] Click en card abre `/polizas/{id}`.
- [ ] Tab "Resumen" muestra datos generales + 3 botones de acción.
- [ ] Tab "Asegurados" tiene tabla con paginado, filtros, selección múltiple.
- [ ] Tab "Discrepancias" tiene 3 sub-tabs con datos.
- [ ] Tab "Endosos" muestra histórico cronológico.
- [ ] Tab "Solicitudes" muestra bandeja filtrada por póliza.
- [ ] Tab "Configuración" solo visible con permiso `puede_editar_email_config`.

---

## I. Carga PDF (wizard)

- [ ] Wizard tiene 3 pasos visibles.
- [ ] Paso 1 acepta solo PDFs <= 10 MB.
- [ ] Paso 2 muestra preview con conteo de matches/dudosos/sin match.
- [ ] Cada línea sin match tiene 3 acciones: Crear / Vincular / Ignorar.
- [ ] Paso 3 muestra confirmación con cantidades.
- [ ] Después de aplicar: `polizas_endosos` tiene 1 nueva fila + `polizas_asegurados` tiene N filas creadas/actualizadas.

---

## J. Solicitar baja MAPFRE

- [ ] Selecciono 2 personas activas en póliza MAPFRE → click "Solicitar baja".
- [ ] Preview muestra:
  - To: `[email Carlos]`
  - CC: vacío
  - Asunto: `Solicitud de Baja - Póliza 2297608`
  - Body: contiene "Buenas Carlos" y "BAJAS" + bloque por persona con DNI + Fecha Nac.
- [ ] Click "Enviar" → email llega al destinatario.
- [ ] Los 2 asegurados pasan a estado `baja_solicitada`.
- [ ] Se crea `polizas_solicitudes` con estado `enviado`.
- [ ] `enviado_en` está poblado.

---

## K. Solicitar baja San Cristóbal

- [ ] Selecciono 3 personas → click "Solicitar baja".
- [ ] Preview muestra:
  - Body con `Cliente Póliza 01-06-06-30035710 _Logística Argentina Srl-_ N° cuenta: 01-02297625`
  - "Informa BAJAS"
  - Asegurados con CUIL **sin guiones** (ej. `20211316749` no `20-21131674-9`)
  - Fecha como `DD/MM/YYYY`.

---

## L. Solicitar alta La Segunda Autos

- [ ] Selecciono 1 vehículo nuevo → click "Solicitar alta".
- [ ] Preview muestra:
  - To: `[email Ramon]`
  - CC: 3 emails (comercial.corrientes + 2 admins)
  - Asunto: `NUEVA ALTA - {patente}` (con la patente real, no el placeholder).
  - Body: "Buenas Ramón..." + "cláusulas de OCA".
- [ ] **Si el proveedor NO tiene las 5 fotos categorizadas → bloqueo de envío** con mensaje claro de qué falta.
- [ ] Si tiene las 5 fotos → se adjuntan automáticamente al email.
- [ ] Email llega con los 5 adjuntos.

### Caso: 2 vehículos seleccionados

- [ ] La UI fuerza a hacer 1 solicitud por vehículo (porque cada uno necesita sus propias fotos).
- [ ] Se crean 2 solicitudes independientes con sus respectivos asuntos `NUEVA ALTA - PAT1` y `NUEVA ALTA - PAT2`.

---

## M. Confirmación de respuesta

- [ ] En detalle de solicitud "enviado" hay botón "Marcar confirmada".
- [ ] Al confirmar baja: asegurados pasan a `dado_de_baja`, registra `fecha_baja_efectiva = NOW()` (o la fecha que ingrese el admin).
- [ ] Al confirmar alta: asegurados pasan a `activo`, registra `fecha_alta_efectiva`.
- [ ] Solicitud queda con `estado = respondida_ok` y `respuesta_recibida_en` poblado.
- [ ] Si "rechazada": asegurados vuelven al estado anterior, `estado = respondida_rechazada` con resumen.

---

## N. Cron de vencimientos

- [ ] Comando `php artisan polizas:alertas-vencimiento` corre sin error.
- [ ] Detecta La Segunda Motos (vence 31/05/2026, hoy es 04/05/2026, faltan 27 días → no dispara).
- [ ] Cuando `today + 15 >= vigencia_hasta` → dispara notificación.
- [ ] Notificación llega a usuarios con `recibe_alertas_vencimiento = TRUE`.

---

## O. Tab Pólizas en Proveedor

- [ ] En `/personal/:id/editar` aparece tab "Pólizas".
- [ ] Tab muestra todas las pólizas activas en las que figura ese proveedor.
- [ ] Cada póliza muestra: aseguradora, identificador (CUIL/patente), estado, fecha de alta efectiva.
- [ ] Si una persona activa en sistema NO tiene una póliza relevante → alerta "Falta cobertura" con botón "Solicitar alta".

---

## P. Permisos

- [ ] Usuario sin permiso `puede_cargar_pdf` no ve botón "Cargar PDF".
- [ ] Usuario sin `puede_solicitar_baja` no ve botón "Solicitar baja".
- [ ] Endpoints rechazan request con 403 si falta permiso.
- [ ] Usuario sin permisos pero autenticado puede ver listado y detalle (modo solo-lectura).

---

## Q. Auditoría

- [ ] Cada solicitud tiene `administrativo_user_id`.
- [ ] Cada cambio de estado de asegurado queda trackeable (vía endoso o vía solicitud).
- [ ] Logs de email enviado disponibles para diagnóstico (`email_message_id`).

---

## R. Performance

- [ ] Listado `/polizas` con 4 pólizas y ~150 asegurados totales responde en < 500ms.
- [ ] Carga de PDF MAPFRE 88 vidas + matching responde en < 5s.
- [ ] Endpoint `/polizas/{id}/asegurados` con 100 asegurados y filtros responde en < 1s.

---

## S. Smoke test end-to-end

Escenario completo (a ejecutar manualmente al final):

1. [ ] **Carga MAPFRE**: subir Constancia MAPFRE → 88 asegurados parseados → 3 con discrepancia (sin persona) → reporte generado.
2. [ ] **Solicitud baja MAPFRE**: pedir baja de 2 fantasmas → email enviado → confirmar respuesta → asegurados quedan en `dado_de_baja`.
3. [ ] **Carga San Cristóbal endoso**: subir endoso 118 → 3 incorporaciones → todas matchean con personas existentes → registro como `alta_endoso_id`.
4. [ ] **Carga La Segunda Autos**: subir certif → 23 vehículos → 2 sin match → reporte de fantasmas → enviar baja de 1 → email correcto → confirmar → vehículo en `dado_de_baja`.
5. [ ] **Carga La Segunda Motos**: subir certif → 8 motos → cron alerta vencimiento dispara (faltan 27 días, no debería disparar; ajustar fecha de prueba para validar).
6. [ ] **Tab Proveedor**: abrir perfil de un distribuidor → ver sus 2 pólizas (MAPFRE + La Segunda Autos con su patente).
7. [ ] **Solicitud alta nuevo distribuidor**: dar de alta a Pedro Pérez en MAPFRE + La Segunda → 2 emails enviados con templates correctos → adjuntos La Segunda obligatorios → confirmar respuesta → ambas pólizas tienen al nuevo activo.

Si los 7 escenarios pasan → MVP listo para producción.
