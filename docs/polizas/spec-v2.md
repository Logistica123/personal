# SPEC TÉCNICO v2 — Módulo Pólizas (Consolidado)

> Versión: 2.0 · Fecha: 05-may-2026
> Para: IA de Francisco · De: Matías
> Este documento reemplaza al spec original + los 7 addendums. Es la versión final unificada con todo aplicado.

---

## Índice

1. Introducción y alcance
2. Modelo de datos completo
3. Parser PDF
4. Algoritmo de matching
5. Reportes de discrepancia
6. Cláusulas de no repetición
7. Templates de email
8. Solicitudes (alta/baja a aseguradora)
9. Notificación al distribuidor
10. Integración con módulo Proveedores
11. Integración con CRM Aprobaciones/Solicitudes
12. Permisos y administrativos
13. Cron jobs
14. UI completa
15. API REST endpoints
16. Criterios de aceptación

---

## 1. Introducción y alcance

### 1.1 Problema

Logística Argentina paga 3 aseguradoras (MAPFRE, San Cristóbal, La Segunda) que cubren personas (Accidentes Personales) y vehículos (autos + motos). Hoy:

- No hay forma sistemática de saber si todos los asegurados de las pólizas siguen activos como distribuidores → se pagan seguros de personas/vehículos que ya no operan.
- Las altas y bajas se piden manualmente por email → sin trazabilidad ni control.
- No hay alerta de vencimiento de pólizas.
- El flujo operativo de aprobación de distribuidor depende de la cobertura de seguro, pero no está integrado con la plataforma.

### 1.2 Solución

Módulo nuevo `Pólizas` con:

- Carga de PDFs de aseguradoras (constancias, endosos, anexos de adherentes) con parsing automático.
- Cruce automático contra base de proveedores (`personas`) para detectar discrepancias.
- Catálogo configurable de cláusulas de no repetición.
- Solicitudes de alta/baja a aseguradoras con templates predefinidos por póliza, con soporte de cláusulas globales e individuales.
- Vinculación de administrativos con permisos granulares.
- Notificación automática al distribuidor cuando se confirma su alta.
- Alertas de vencimiento de póliza con anticipación configurable.
- Integración con CRM Aprobaciones/Solicitudes para flujo bidireccional.

### 1.3 Pólizas en alcance

| Aseguradora | Póliza | N° | Cliente / contexto |
|---|---|---|---|
| MAPFRE | AP Distribuidores OCASA | 2297608 | Cláusula OCASA |
| MAPFRE | AP URBANO / Otras Empresas | 2297847 | Cláusula URBANO/NEWSAN |
| MAPFRE | AP NEWSAN | 2298721 | Cláusulas NEWSAN La Tablada |
| San Cristóbal | AP Colectivo | 01-06-06-30035710 | Pueden aplicar cláusulas de cualquier cliente |
| La Segunda | Vehículos Autos | 67.743.063 | Cláusula OCA típicamente |
| La Segunda | Vehículos Motos | 45.597.407 | — |

---

## 2. Modelo de datos completo

### 2.1 Tabla `polizas_aseguradoras`

```sql
CREATE TABLE polizas_aseguradoras (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    parser_perfil VARCHAR(50) NOT NULL UNIQUE,
    cuit VARCHAR(15) NULL,
    domicilio VARCHAR(255) NULL,
    web VARCHAR(255) NULL,
    email_general VARCHAR(150) NULL,
    notas TEXT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parser (parser_perfil),
    INDEX idx_activa (activa)
);
```

### 2.2 Tabla `polizas`

```sql
CREATE TABLE polizas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    aseguradora_id BIGINT NOT NULL,
    nombre_descriptivo VARCHAR(150) NOT NULL,
    ramo ENUM('accidentes_personales','vehiculos') NOT NULL,
    subramo VARCHAR(100) NULL,
    tipo_asegurado ENUM('persona','vehiculo') NOT NULL,
    numero_poliza VARCHAR(50) NOT NULL,
    numero_cuenta_cliente VARCHAR(50) NULL,
    vigencia_desde DATE NOT NULL,
    vigencia_hasta DATE NOT NULL,
    tomador_cuit VARCHAR(15) NULL,
    tomador_razon_social VARCHAR(150) NULL,
    tomador_domicilio VARCHAR(255) NULL,
    suma_asegurada_total DECIMAL(18,2) NULL,
    premio_anual DECIMAL(14,2) NULL,
    cantidad_vidas_unidades INT NOT NULL DEFAULT 0,
    clausulas_especiales TEXT NULL,
    alerta_dias_antes_vencimiento INT NOT NULL DEFAULT 15,
    ofrecer_auto_aprobacion_distribuidor BOOLEAN NOT NULL DEFAULT TRUE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (aseguradora_id) REFERENCES polizas_aseguradoras(id),
    INDEX idx_aseguradora (aseguradora_id),
    INDEX idx_vigencia (vigencia_desde, vigencia_hasta),
    INDEX idx_activa (activa),
    UNIQUE KEY uniq_poliza_numero (aseguradora_id, numero_poliza)
);
```

### 2.3 Tabla `polizas_email_config`

```sql
CREATE TABLE polizas_email_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    tipo ENUM('alta','baja') NOT NULL,
    destinatarios_to JSON NOT NULL,
    destinatarios_cc JSON NULL,
    destinatarios_bcc JSON NULL,
    contacto_nombre VARCHAR(100) NULL,
    asunto_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    asegurado_template TEXT NOT NULL,
    separador_entre_asegurados VARCHAR(10) NOT NULL DEFAULT '\n',
    adjuntos_requeridos JSON NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_poliza_tipo (poliza_id, tipo)
);
```

### 2.4 Tabla `polizas_endosos`

```sql
CREATE TABLE polizas_endosos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    numero_endoso VARCHAR(50) NOT NULL,
    tipo ENUM(
        'constancia',
        'incorporacion',
        'baja',
        'modificacion',
        'asegurados_adherentes'
    ) NOT NULL,
    fecha_emision DATE NOT NULL,
    archivo_id BIGINT NULL,
    descripcion TEXT NULL,
    premio_endoso DECIMAL(14,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    INDEX idx_poliza (poliza_id),
    INDEX idx_fecha (fecha_emision)
);
```

### 2.5 Tabla `polizas_asegurados`

```sql
CREATE TABLE polizas_asegurados (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    persona_id BIGINT NULL,
    tipo_asegurado ENUM('persona','vehiculo') NOT NULL,
    identificador VARCHAR(50) NOT NULL,
    identificador_tipo ENUM('dni','cuil','patente') NOT NULL,
    numero_orden_aseguradora VARCHAR(20) NULL,
    nombre_apellido_pdf VARCHAR(200) NULL,
    marca_modelo_pdf VARCHAR(150) NULL,
    tipo_vehiculo_pdf VARCHAR(50) NULL,
    localidad_pdf VARCHAR(100) NULL,
    suma_asegurada DECIMAL(14,2) NULL,
    premio_individual DECIMAL(14,2) NULL,
    alta_endoso_id BIGINT NULL,
    baja_endoso_id BIGINT NULL,
    fecha_alta_efectiva DATE NULL,
    fecha_baja_efectiva DATE NULL,
    estado ENUM('activo','alta_solicitada','baja_solicitada','dado_de_baja','no_matcheado')
        NOT NULL DEFAULT 'activo',
    match_score DECIMAL(4,3) NULL,
    match_metodo ENUM('cuil_exacto','dni_exacto','patente_exacto','manual') NULL,
    persona_estado_al_matchear VARCHAR(50) NULL,
    persona_alerta_estado VARCHAR(80) NULL,
    sugerencia_fuzzy_persona_id BIGINT NULL,
    sugerencia_fuzzy_score DECIMAL(4,3) NULL,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL,
    FOREIGN KEY (alta_endoso_id) REFERENCES polizas_endosos(id) ON DELETE SET NULL,
    FOREIGN KEY (baja_endoso_id) REFERENCES polizas_endosos(id) ON DELETE SET NULL,
    FOREIGN KEY (sugerencia_fuzzy_persona_id) REFERENCES personas(id) ON DELETE SET NULL,
    UNIQUE KEY uniq_poliza_identificador (poliza_id, identificador),
    INDEX idx_poliza_estado (poliza_id, estado),
    INDEX idx_persona (persona_id),
    INDEX idx_identificador (identificador),
    INDEX idx_alerta_estado (persona_alerta_estado)
);
```

### 2.6 Tabla `polizas_solicitudes`

```sql
CREATE TABLE polizas_solicitudes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    tipo ENUM('alta','baja') NOT NULL,
    administrativo_user_id BIGINT NOT NULL,
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    destinatarios_to_resueltos JSON NOT NULL,
    destinatarios_cc_resueltos JSON NULL,
    asunto VARCHAR(255) NOT NULL,
    body LONGTEXT NOT NULL,
    adjuntos JSON NULL,
    tipo_clausula_global ENUM('ninguna','aplicar','previa_existente') NOT NULL DEFAULT 'ninguna',
    clausula_global_id BIGINT NULL,
    estado ENUM('borrador','enviado','respondida_ok','respondida_rechazada','cancelada')
        NOT NULL DEFAULT 'borrador',
    enviado_en TIMESTAMP NULL,
    respuesta_recibida_en TIMESTAMP NULL,
    respuesta_resumen TEXT NULL,
    email_message_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id),
    FOREIGN KEY (administrativo_user_id) REFERENCES users(id),
    FOREIGN KEY (clausula_global_id) REFERENCES polizas_clausulas(id) ON DELETE SET NULL,
    INDEX idx_poliza (poliza_id),
    INDEX idx_estado (estado),
    INDEX idx_admin (administrativo_user_id)
);
```

### 2.7 Tabla `polizas_solicitud_asegurados`

```sql
CREATE TABLE polizas_solicitud_asegurados (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    solicitud_id BIGINT NOT NULL,
    asegurado_id BIGINT NULL,
    persona_id BIGINT NULL,
    clausula_individual_id BIGINT NULL,
    observaciones TEXT NULL,
    FOREIGN KEY (solicitud_id) REFERENCES polizas_solicitudes(id) ON DELETE CASCADE,
    FOREIGN KEY (asegurado_id) REFERENCES polizas_asegurados(id),
    FOREIGN KEY (persona_id) REFERENCES personas(id),
    FOREIGN KEY (clausula_individual_id) REFERENCES polizas_clausulas(id) ON DELETE SET NULL
);
```

> **Nota:** la solicitud puede estar vinculada a un `asegurado_id` (caso baja, donde ya existe el registro) o a un `persona_id` (caso alta de una persona que aún no es asegurado). Por eso ambos pueden ser NULL pero al menos uno debe estar poblado.

### 2.8 Tabla `polizas_clausulas`

```sql
CREATE TABLE polizas_clausulas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre_corto VARCHAR(100) NOT NULL,
    alias VARCHAR(50) NOT NULL,
    cliente_id BIGINT NULL,
    sucursal_id BIGINT NULL,
    cuit_titular VARCHAR(15) NOT NULL,
    razon_social_titular VARCHAR(150) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'no_repeticion',
    descripcion_corta VARCHAR(255) NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE SET NULL,
    INDEX idx_cliente (cliente_id),
    INDEX idx_sucursal (sucursal_id)
);
```

### 2.9 Tabla `polizas_clausulas_aplicadas`

```sql
CREATE TABLE polizas_clausulas_aplicadas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    clausula_id BIGINT NOT NULL,
    tipo_aplicacion ENUM('global','individual') NOT NULL DEFAULT 'global',
    aplicada_desde DATE NOT NULL,
    aplicada_hasta DATE NULL,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    FOREIGN KEY (clausula_id) REFERENCES polizas_clausulas(id),
    UNIQUE KEY uniq_poliza_clausula_desde (poliza_id, clausula_id, aplicada_desde),
    INDEX idx_poliza (poliza_id),
    INDEX idx_clausula (clausula_id)
);
```

### 2.10 Tabla `polizas_asegurados_clausulas`

```sql
CREATE TABLE polizas_asegurados_clausulas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asegurado_id BIGINT NOT NULL,
    clausula_id BIGINT NOT NULL,
    aplicada_desde DATE NOT NULL,
    aplicada_hasta DATE NULL,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asegurado_id) REFERENCES polizas_asegurados(id) ON DELETE CASCADE,
    FOREIGN KEY (clausula_id) REFERENCES polizas_clausulas(id),
    UNIQUE KEY uniq_asegurado_clausula_desde (asegurado_id, clausula_id, aplicada_desde)
);
```

### 2.11 Tabla `polizas_admin_permisos`

```sql
CREATE TABLE polizas_admin_permisos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    puede_cargar_pdf BOOLEAN NOT NULL DEFAULT FALSE,
    puede_solicitar_alta BOOLEAN NOT NULL DEFAULT FALSE,
    puede_solicitar_baja BOOLEAN NOT NULL DEFAULT FALSE,
    puede_confirmar_respuesta BOOLEAN NOT NULL DEFAULT FALSE,
    puede_editar_email_config BOOLEAN NOT NULL DEFAULT FALSE,
    puede_gestionar_clausulas BOOLEAN NOT NULL DEFAULT FALSE,
    puede_notificar_distribuidores BOOLEAN NOT NULL DEFAULT FALSE,
    recibe_alertas_vencimiento BOOLEAN NOT NULL DEFAULT FALSE,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_user (user_id)
);
```

### 2.12 Tabla `polizas_notif_distribuidor_config`

```sql
CREATE TABLE polizas_notif_distribuidor_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    poliza_id BIGINT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    asunto_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    cc_admin_email VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_poliza (poliza_id)
);
```

### 2.13 Tabla `polizas_notificaciones_distribuidor`

```sql
CREATE TABLE polizas_notificaciones_distribuidor (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asegurado_id BIGINT NOT NULL,
    poliza_id BIGINT NOT NULL,
    persona_id BIGINT NOT NULL,
    tipo ENUM('alta','baja') NOT NULL DEFAULT 'alta',
    email_destinatario VARCHAR(150) NOT NULL,
    asunto VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    estado ENUM('pendiente','enviado','rebotado','sin_email') NOT NULL DEFAULT 'pendiente',
    enviado_en TIMESTAMP NULL,
    error_envio TEXT NULL,
    enviado_por_user_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asegurado_id) REFERENCES polizas_asegurados(id) ON DELETE CASCADE,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id),
    FOREIGN KEY (persona_id) REFERENCES personas(id),
    FOREIGN KEY (enviado_por_user_id) REFERENCES users(id),
    INDEX idx_persona (persona_id),
    INDEX idx_estado (estado),
    INDEX idx_poliza (poliza_id)
);
```

### 2.14 ALTER en tabla existente `archivos`

```sql
ALTER TABLE archivos
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) NULL AFTER nombre,
  ADD INDEX IF NOT EXISTS idx_categoria (categoria);
```

Slugs reservados para `categoria`:
- `foto_frente`, `foto_lateral_der`, `foto_lateral_izq`, `foto_trasera`
- `cedula_frente`, `cedula_dorso`
- `dni_frente`, `dni_dorso`
- `generico`

---

## 3. Parser PDF

### 3.1 Endpoint

```
POST /api/polizas/parse-pdf
Headers: multipart/form-data
Body: file=<PDF>
```

### 3.2 Auto-detección de aseguradora

Lectura de header del PDF y aplicación de regex en orden:

```python
def detectar_aseguradora(text):
    if re.search(r'MAPFRE\s+ARGENTINA', text, re.IGNORECASE):
        return 'MAPFRE'
    if re.search(r'SAN\s+CRISTOBAL\s+S\.M\.S\.G\.', text, re.IGNORECASE):
        return 'SAN_CRISTOBAL'
    if re.search(r'lasegunda\.com\.ar', text, re.IGNORECASE):
        return 'LA_SEGUNDA'
    return None
```

Si retorna `None` → response con error 400 y permitir al admin elegir manualmente.

### 3.3 Detección de tipo de documento (San Cristóbal)

San Cristóbal tiene 4 tipos de PDF que el parser debe distinguir:

```python
def detectar_tipo_documento_sc(text):
    if re.search(r'Anexo de Adherentes\s+\d+\s+de\s+\d+', text):
        return 'asegurados_adherentes'
    if re.search(r'Incorporación de Asegurados', text):
        return 'incorporacion'
    if re.search(r'Anulación de Asegurados|Bajas', text):
        return 'baja'
    if re.search(r'Otras Modificaciones', text):
        return 'modificacion'
    return 'desconocido'
```

### 3.4 Perfil MAPFRE

Datos de póliza:

```python
patterns = {
    'numero_poliza': r'Póliza N°\s*:\s*(\d+)',
    'vigencia_desde': r'Vigencia desde el (\d{2}/\d{2}/\d{4})',
    'vigencia_hasta': r'hasta el (\d{2}/\d{2}/\d{4})',
    'tomador_cuit': r'CUIT/CUIL/DU:\s*(\d+)',
    'tomador_razon_social': r'Tomador:\s*([^\n]+)',
    'plan': r'Plan:\s*([^\n]+)',
    'vidas_vigentes': r'Vidas vigentes:\s*(\d+)',
    'suma_asegurada_total': r'MUERTE E INCAPACIDAD\s*-\s*\$\s*([\d,\.]+)',
}
```

Asegurados (constancia):

```
DU 36193874 ACEVEDO LUIS ALBERTO
DU 25016089 AGUILAR JORGE ANDRES
CL 20217198365 CANETE GUSTAVO JAVIER
```

Regex:

```python
RE_MAPFRE_LINEA = re.compile(
    r'^(DU|CL)\s+(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)$',
    re.MULTILINE
)
# DU = identificador_tipo='dni', CL = identificador_tipo='cuil'
```

### 3.5 Perfil San Cristóbal

#### 3.5.1 Tipo "Anexo de Adherentes" (más común)

Estructura:

```
Anexo de Adherentes 1 de N
Información de Póliza
TOMADOR | RAMO | VIGENCIA DESDE | VIGENCIA HASTA | ENDOSO
DIRECCIÓN | N° PÓLIZA | PROVINCIA | LUGAR Y FECHA EMISIÓN
Listado de Asegurados
Grupo 1: <nombre>
N° ADHERENTE | APELLIDO Y NOMBRES | TIPO Y NRO DE DOC | FECHA NACIMIENTO | OCUPACIÓN | FECHA ALTA
```

Parser usa `pdfplumber.extract_tables()` por la complejidad multi-línea de la columna OCUPACIÓN:

```python
def parse_sc_adherentes(file):
    asegurados = []
    with pdfplumber.open(file) as pdf:
        text_p1 = pdf.pages[0].extract_text()
        poliza = {
            'numero_poliza': extract(r'(\d{2}-\d{2}-\d{2}-\d{8})', text_p1),
            'vigencia_desde': parse_date(extract(r'VIGENCIA DESDE.*?(\d{2}/\d{2}/\d{4})', text_p1)),
            'vigencia_hasta': parse_date(extract(r'VIGENCIA HASTA.*?(\d{2}/\d{2}/\d{4})', text_p1)),
            'numero_endoso': extract(r'ENDOSO\s+(\d+)', text_p1),
            'fecha_emision': parse_date(extract(r'Resistencia,\s*(\d{2}/\d{2}/\d{4})', text_p1)),
        }

        for page in pdf.pages:
            for table in page.extract_tables():
                if not table or len(table) < 2:
                    continue
                header = [c.strip() if c else '' for c in table[0]]
                if not any('ADHERENTE' in h.upper() for h in header):
                    continue

                col_idx = {
                    'numero': find_col(header, 'ADHERENTE'),
                    'nombre': find_col(header, 'APELLIDO'),
                    'doc': find_col(header, 'DOC'),
                    'fecha_nac': find_col(header, 'NACIMIENTO'),
                    'ocupacion': find_col(header, 'OCUPACIÓN'),
                    'fecha_alta': find_col(header, 'FECHA ALTA'),
                }

                for row in table[1:]:
                    if not row[col_idx['numero']] or not row[col_idx['numero']].strip().isdigit():
                        continue
                    asegurados.append({
                        'tipo': 'persona',
                        'identificador': row[col_idx['doc']].strip(),
                        'identificador_tipo': 'cuil',
                        'numero_orden_aseguradora': row[col_idx['numero']].strip(),
                        'nombre_apellido': row[col_idx['nombre']].strip(),
                        'fecha_nacimiento': parse_date(row[col_idx['fecha_nac']]),
                        'ocupacion': normalize_text(row[col_idx['ocupacion']]),
                        'fecha_alta_efectiva': parse_date(row[col_idx['fecha_alta']]),
                    })

    return {'tipo_documento': 'asegurados_adherentes', 'poliza': poliza, 'asegurados': asegurados}
```

#### 3.5.2 Tipo "Frente de Endoso" (Incorporación / Baja / Modificación)

```python
RE_SC_LINEA = re.compile(
    r'^(\d+)\s+'
    r'([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)\s+'
    r'(\d{2}-\d{8}-\d)\s+'
    r'(\d{2}/\d{2}/\d{4})\s+'
    r'(.+?)$',
    re.MULTILINE
)
```

### 3.6 Perfil La Segunda

Distinción Autos vs Motos por header:
- "Póliza para el seguro de vehículos automotores" → Autos (póliza típica 67.743.063)
- "Póliza para el seguro de motovehículos" → Motos (póliza típica 45.597.407)

Parser usa `pdfplumber.extract_tables()`:

```python
def parse_la_segunda(file):
    asegurados = []
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table[1:]:
                    if not row[0] or not row[0].strip().isdigit():
                        continue
                    asegurados.append({
                        'tipo': 'vehiculo',
                        'identificador': normalizar_patente(row[2]),
                        'identificador_tipo': 'patente',
                        'numero_orden_aseguradora': row[0],
                        'marca_modelo': row[3] or row[4],
                        'tipo_vehiculo': row[5],
                        'año': int(row[6]) if row[6] else None,
                        'localidad': row[7],
                        'suma_asegurada': parse_money(row[8]),
                        'premio_individual': parse_money(row[-2]),
                    })
    return {'tipo_documento': 'constancia', 'poliza': poliza, 'asegurados': asegurados}
```

### 3.7 Helpers comunes

```python
def parse_money(s):
    if not s: return None
    s = re.sub(r'[\$\.\s]', '', s).replace(',', '.')
    return float(s) if s else None

def parse_date(s):
    return datetime.strptime(s, '%d/%m/%Y').strftime('%Y-%m-%d') if s else None

def normalizar_cuil(c):
    return re.sub(r'\D', '', c)

def extraer_dni_del_cuil(cuil):
    digitos = normalizar_cuil(cuil)
    return digitos[2:10] if len(digitos) == 11 else None

def normalizar_patente(p):
    return p.upper().replace(' ', '').replace('-', '').strip()

def normalize_text(s):
    return ' '.join(s.split()) if s else ''

def find_col(header, keyword):
    for i, h in enumerate(header):
        if keyword.upper() in h.upper():
            return i
    return -1
```

---

## 4. Algoritmo de matching

### 4.1 Regla central

**Match SOLO por identificador exacto.** Sin fuzzy automático.

| Método | Tipo | Aplicación |
|---|---|---|
| `cuil_exacto` | Persona | Match seguro |
| `dni_exacto` | Persona | Match seguro |
| `patente_exacto` | Vehículo | Match seguro |
| `manual` | Persona/Vehículo | Vinculación manual hecha por admin desde wizard |

### 4.2 Matchear contra TODA la base de personas

**Sin filtros de estado.** Personas en baja, suspendidas, en solicitud o sin aprobar deben aparecer en el match. El estado se enriquece en el reporte (categoría D — estado inconsistente).

```php
function matchear_persona($asegurado_pdf) {
    // 1. CUIL exacto
    if ($asegurado_pdf->cuil) {
        $cuil_norm = normalizar_cuil($asegurado_pdf->cuil);
        $match = Persona::where('cuil_normalizado', $cuil_norm)->first();
        if ($match) return ['persona_id' => $match->id, 'metodo' => 'cuil_exacto', 'score' => 1.0];
    }

    // 2. DNI exacto
    $dni = $asegurado_pdf->dni ?: extraer_dni_del_cuil($asegurado_pdf->cuil);
    if ($dni) {
        $match = Persona::where('cuil', 'LIKE', "%-{$dni}-%")->first();
        if ($match) return ['persona_id' => $match->id, 'metodo' => 'dni_exacto', 'score' => 1.0];
    }

    // 3. Sin match exacto → null
    return null;
}

function matchear_vehiculo($vehiculo_pdf) {
    $patente = normalizar_patente($vehiculo_pdf->patente);

    // 1. patente principal
    $match = Persona::where('patente', $patente)->first();
    if ($match) return ['persona_id' => $match->id, 'metodo' => 'patente_exacto', 'score' => 1.0];

    // 2. patentes adicionales
    $match = PersonaPatente::where('patente', $patente)->first();
    if ($match) return ['persona_id' => $match->persona_id, 'metodo' => 'patente_exacto', 'score' => 1.0];

    return null;
}
```

### 4.3 Sugerencia fuzzy (no auto-match)

Para no perder asistencia útil — el matching calcula candidato fuzzy por nombre y lo guarda como **sugerencia** en `polizas_asegurados.sugerencia_fuzzy_persona_id` y `sugerencia_fuzzy_score`. La UI lo muestra en el preview, pero NO vincula automáticamente.

```php
function sugerir_fuzzy_nombre($asegurado_pdf) {
    $nombre_norm = normalize($asegurado_pdf->nombre_apellido);
    $candidatos = Persona::all()
        ->map(fn($p) => ['p' => $p, 'score' => similar_text_score($nombre_norm, normalize($p->apellidos . ' ' . $p->nombres))])
        ->filter(fn($x) => $x['score'] >= 0.85)
        ->sortByDesc('score')
        ->first();
    return $candidatos ? ['persona_id' => $candidatos['p']->id, 'score' => $candidatos['score']] : null;
}
```

### 4.4 Enriquecimiento del estado de persona

Después del match exacto, calcular el estado actual de la persona y guardarlo:

```php
function calcular_alerta_estado($persona, $asegurado) {
    if (!$persona) return null;
    if ($persona->fecha_baja && $asegurado->estado == 'activo')
        return 'persona_baja_en_poliza_activa';
    if ($persona->estado_id == ESTADO_SUSPENDIDO && $asegurado->estado == 'activo')
        return 'persona_suspendida_en_poliza_activa';
    if ($persona->es_solicitud && $asegurado->estado == 'activo')
        return 'persona_solicitud_pendiente_en_poliza_activa';
    if (!$persona->aprobado && $asegurado->estado == 'activo')
        return 'persona_sin_aprobar_en_poliza_activa';
    return null;
}
```

Guardado en `polizas_asegurados.persona_alerta_estado`.

### 4.5 Recálculo periódico

Cron diario `polizas:recalcular-estados-asegurados` que actualiza `persona_estado_al_matchear` y `persona_alerta_estado` por si la persona cambió de estado después del matching original.

---

## 5. Reportes de discrepancia

### 5.1 4 categorías

```
GET /api/polizas/{id}/discrepancias

Response:
{
  "asegurados_sin_persona": [...],          // A. Fantasmas — pagamos seguro de personas/vehículos no nuestros
  "personas_sin_poliza": [...],             // B. Sin cobertura — distribuidores activos sin alta en póliza
  "match_dudoso": [...],                    // C. Match dudoso — sugerencias fuzzy para revisión manual
  "estado_inconsistente": {                 // D. Persona y póliza con estados desalineados
      "persona_baja_en_poliza_activa": [...],
      "persona_suspendida_en_poliza_activa": [...],
      "persona_solicitud_pendiente_en_poliza_activa": [...],
      "persona_sin_aprobar_en_poliza_activa": [...]
  }
}
```

### 5.2 Filtros disponibles

- Categoría (A / B / C / D)
- Sucursal
- Cliente
- Antigüedad (todos / >30d / >60d / >90d)
- Búsqueda texto libre (nombre / identificador / CUIL)
- Export Excel

### 5.3 Acciones rápidas por categoría

| Categoría | Acción rápida |
|---|---|
| A — Sin persona | "Pedir baja" / "Vincular a persona existente" |
| B — Sin póliza | "Pedir alta" |
| C — Match dudoso | "Confirmar vinculación" / "Rechazar" |
| D — Estado inconsistente | "Pedir baja en póliza" (típico) / "Reactivar persona" |

---

## 6. Cláusulas de no repetición

### 6.1 Concepto

Las cláusulas son cláusulas legales que el cliente con el que opera Logística Argentina (OCASA, NEWSAN, URBANO, OCA) le exige que estén incluidas en su seguro. **Cualquier alta en cualquier póliza puede tener cláusula global y/o individual.**

### 6.2 Catálogo inicial (seed)

```sql
INSERT INTO polizas_clausulas (nombre_corto, alias, cuit_titular, razon_social_titular, descripcion_corta, tipo, activa) VALUES
  ('OCASA', 'OCASA', '30-66204961-8', 'OCASA',
   'Con clausula de Ocasa CUIT N 30 66204961 8', 'no_repeticion', TRUE),
  ('URBANO Suc. Moreno - NEWSAN', 'URBANO', '30-64261755-5', 'NEWSAN S.A.',
   'Con clausula de NEWSAN S.A. CUIT N 30 64261755 5', 'no_repeticion', TRUE),
  ('NEWSAN', 'NEWSAN', '30-64261755-5', 'NEWSAN S.A.',
   'Con clausula de NEWSAN S.A. CUIT N 30 64261755 5', 'no_repeticion', TRUE),
  ('NEWSAN La Tablada - CBN', 'NEWSAN', '30-71159690-5', 'CBN',
   'Con clausula de CBN CUIT N 30 71159690 5', 'no_repeticion', TRUE),
  ('NEWSAN La Tablada - ID Supply Chain', 'NEWSAN', '30-71069830-5', 'ID Supply Chain S.A.',
   'Con clausula de ID Supply Chain S.A. CUIT N 30 71069830 5', 'no_repeticion', TRUE),
  ('OCA Parque Norte / Avellaneda', 'OCA', '30-71702439-3', 'OCA',
   'Con clausula de No Repetición a nombre de OCA CUIT N 30 71702439 3', 'no_repeticion', TRUE);
```

### 6.3 Tipo aplicación

- **Global** — la cláusula afecta a todos los asegurados del bloque del email. Se aplica a la póliza vía `polizas_clausulas_aplicadas` con `tipo_aplicacion = 'global'`.
- **Individual** — la cláusula es específica para 1 asegurado puntual. Se registra en `polizas_asegurados_clausulas`.
- Ambas pueden coexistir en el mismo email.

### 6.4 Render por aseguradora

| Aseguradora | Cláusula global | Cláusula individual |
|---|---|---|
| MAPFRE | inline en cada nombre `(...)` o referencia a "endosos previos" | inline en nombre específico `(...)` |
| San Cristóbal | línea separada arriba con guión `-(...)` | inline después del nombre `-(...)` |
| La Segunda | frase dinámica en el body "tenga las cláusulas de {alias}" | inline (raro) `-(...)` |

```php
function render_clausula_inline($asegurado_decision, $aseguradora_perfil) {
    if (!$asegurado_decision->clausula) return '';
    $desc = $asegurado_decision->clausula->descripcion_corta;
    return match($aseguradora_perfil) {
        'mapfre' => ' (' . $desc . ')',
        'san_cristobal' => ' -(' . $desc . ')',
        'la_segunda' => ' -(' . $desc . ')',
        default => ' (' . $desc . ')',
    };
}
```

---

## 7. Templates de email

### 7.1 Sistema de placeholders

#### A nivel póliza (resueltos al renderizar)

| Placeholder | Origen |
|---|---|
| `{numero_poliza}` | `polizas.numero_poliza` |
| `{numero_cuenta}` | `polizas.numero_cuenta_cliente` |
| `{contacto_nombre}` | `polizas_email_config.contacto_nombre` |
| `{cuit_logarg}` | constante `30-71706098-5` |
| `{razon_social_logarg}` | constante "Logística Argentina S.R.L." |
| `{admin_nombre}` | usuario logueado |
| `{admin_email}` | usuario logueado |
| `{fecha_solicitud}` | now() |
| `{aseguradora}` | `polizas_aseguradoras.nombre` |
| `{ramo}` | "Accidentes Personales" / "Vehículos" |
| `{vigencia_hasta}` | `polizas.vigencia_hasta` |

#### A nivel cláusula global

| Placeholder | Aseguradoras | Renderiza |
|---|---|---|
| `{clausula_global_block}` | San Cristóbal | Línea separada `-(descripcion_corta)` o vacío |
| `{texto_intro_alta}` | San Cristóbal | "Informa Altas" / "Informa nuevas altas EN ÍDEM CONDICIONES..." |
| `{texto_clausula_previa}` | MAPFRE | "Por favor, incluir las mismas cláusulas..." o vacío |
| `{texto_clausula_la_segunda}` | La Segunda | "Solicito que el seguro de La Segunda tenga las cláusulas de {alias} por favor." o vacío |

#### A nivel asegurado (en `asegurado_template`)

| Placeholder | Renderiza |
|---|---|
| `{nombre_apellido}` | Nombre completo |
| `{clausula_inline}` | Cláusula individual de ese asegurado |
| `{numero_asegurado}` | Solo SC: 1, 2, 3... |
| `{dni}` | DNI sin puntos (MAPFRE) |
| `{dni_con_puntos}` | DNI con puntos (SC) |
| `{cuil}` | CUIL con guiones |
| `{cuil_sin_guiones}` | CUIL sin guiones (SC bajas) |
| `{patente}` | Patente normalizada |
| `{marca_modelo}` | Marca y modelo |
| `{fecha_nac}` | Fecha en `DD/MM/AAAA` |
| `{numero_orden_aseguradora}` | "412", "1", etc. |

### 7.2 Templates seed por póliza

#### MAPFRE Alta (universal con cláusulas)

```json
{
  "to": ["TODO_carlos@mapfre.com.ar"],
  "cc": [],
  "contacto_nombre": "Carlos",
  "asunto": "Solicitud de Alta - Póliza {numero_poliza}",
  "body": "Buenas {contacto_nombre}\n\nMe comunico para solicitar el alta del siguiente distribuidor a la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.{texto_clausula_previa}\n\nALTAS\n\n{asegurados_block}",
  "asegurado_template": "Nombre Completo: {nombre_apellido}{clausula_inline}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n",
  "separador_entre_asegurados": "\n",
  "adjuntos_requeridos": []
}
```

#### MAPFRE Baja

```json
{
  "to": ["TODO_carlos@mapfre.com.ar"],
  "cc": [],
  "contacto_nombre": "Carlos",
  "asunto": "Solicitud de Baja - Póliza {numero_poliza}",
  "body": "Buenas {contacto_nombre}\n\nMe comunico para solicitar la baja del siguiente distribuidor de la póliza de Accidentes Personales N° {numero_poliza} de Logística Argentina S.R.L. – CUIT 30-71706098-5.\n\nBAJAS\n\n{asegurados_block}",
  "asegurado_template": "Nombre Completo: {nombre_apellido}\nDNI: {dni}\nFecha de Nacimiento: {fecha_nac}\n",
  "adjuntos_requeridos": []
}
```

#### San Cristóbal Alta (con numeración + cláusulas)

```json
{
  "to": ["TODO_altas@sancristobal.com.ar"],
  "cc": [],
  "asunto": "Altas - Póliza {numero_poliza}",
  "body": "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_N° cuenta: {numero_cuenta}\n\n{texto_intro_alta}\n{clausula_global_block}\n{asegurados_block}",
  "asegurado_template": "{numero_asegurado})_: {nombre_apellido}{clausula_inline} DNI: {dni_con_puntos} FECHA DE NACIMIENTO: {fecha_nac}",
  "separador_entre_asegurados": "\n\n",
  "adjuntos_requeridos": []
}
```

#### San Cristóbal Baja

```json
{
  "to": ["TODO_bajas@sancristobal.com.ar"],
  "cc": [],
  "asunto": "Bajas - Póliza {numero_poliza}",
  "body": "Cliente Póliza {numero_poliza} _Logística Argentina Srl-_ N° cuenta: {numero_cuenta}\n\nInforma BAJAS\n\n{asegurados_block}",
  "asegurado_template": "{nombre_apellido} CUIL: {cuil_sin_guiones} FECHA DE NACIMIENTO: {fecha_nac}",
  "separador_entre_asegurados": "\n",
  "adjuntos_requeridos": []
}
```

#### La Segunda Autos Alta (con adjuntos obligatorios)

```json
{
  "to": ["TODO_ramon.morel@lasegunda.com.ar"],
  "cc": ["TODO_comercial.corrientes@lasegunda.com.ar","TODO_admin1@logarg..."],
  "contacto_nombre": "Ramón",
  "asunto": "NUEVA ALTA - {patente}",
  "body": "Buenas {contacto_nombre}, solicito el alta de esta unidad dentro de la flota de Logística Argentina.\nDatos del asegurado se encuentra en la cedula.{texto_clausula_la_segunda}\n\nEstoy atenta a cualquier novedad.\n\nSaludos!",
  "asegurado_template": "{patente}",
  "adjuntos_requeridos": ["foto_frente","foto_lateral_der","foto_lateral_izq","foto_trasera","cedula_frente"]
}
```

#### La Segunda Autos Baja

```json
{
  "to": ["TODO_comercial.corrientes@lasegunda.com.ar"],
  "cc": ["TODO_ramon.morel@lasegunda.com.ar"],
  "contacto_nombre": "Ramón",
  "asunto": "BAJA",
  "body": "Buenos días {contacto_nombre}\n\nSolicito bajas de las siguientes unidades que se encuentran dentro de la flota de Logística Argentina.\n\n{asegurados_block}\n\nAguardo confirmación\n\nSaludos",
  "asegurado_template": "{patente}",
  "adjuntos_requeridos": []
}
```

#### La Segunda Motos Alta y Baja

Mismo formato que Autos pero adaptado a "moto" en el body.

### 7.3 Validación de adjuntos pre-envío

```php
function validar_adjuntos($persona, $adjuntos_requeridos) {
    $archivos = $persona->archivos()->whereIn('categoria', $adjuntos_requeridos)->get();
    $presentes = $archivos->pluck('categoria')->toArray();
    $faltantes = array_diff($adjuntos_requeridos, $presentes);
    if ($faltantes) {
        throw new ValidationException(
            "Faltan documentos: " . implode(', ', $faltantes)
        );
    }
    return $archivos->pluck('id')->toArray();
}
```

Si faltan → bloqueo del envío con mensaje claro.

### 7.4 Caso especial — La Segunda Autos Alta = 1 vehículo por solicitud

Cuando el admin selecciona N vehículos para alta de La Segunda Autos:
- La UI fuerza a crear **N solicitudes independientes**, una por vehículo.
- Cada una con su propio asunto `NUEVA ALTA - {patente}` y sus 5 adjuntos.
- Razón: cada vehículo necesita sus propias fotos de cédula y vehículo.

---

## 8. Solicitudes (alta/baja a aseguradora)

### 8.1 Wizard universal

Pasos:

```
1. Selección de personas/vehículos
2. Cláusulas (paso A: global / paso B: individuales — opcional)
3. Preview email
4. Enviar
```

### 8.2 Selectores correctos por tipo

#### Solicitar ALTA

Endpoint: `GET /api/polizas/{id}/personas-disponibles-para-alta`

Query: personas que NO son asegurados activos en esta póliza. **Sin filtro de estado de persona** (incluye Activo / Solicitud / Suspendido / Baja / Sin aprobar).

```sql
SELECT p.*
  FROM personas p
 WHERE p.id NOT IN (
    SELECT pa.persona_id FROM polizas_asegurados pa
     WHERE pa.poliza_id = ?
       AND pa.estado IN ('activo', 'alta_solicitada')
       AND pa.persona_id IS NOT NULL
 )
 ORDER BY p.apellidos, p.nombres;
```

UI: cada persona muestra un badge con su estado al lado del nombre:
- Activo → verde
- Solicitud pendiente → azul
- Suspendido → ámbar
- Baja → rojo

#### Solicitar BAJA

Endpoint: `GET /api/polizas/{id}/asegurados?estado=activo`

Query: asegurados con estado activo o alta_solicitada en esta póliza.

### 8.3 Paso 2 — Cláusulas (universal para todas las aseguradoras)

#### Sub-paso A: Cláusula global

```
⦿ Sin cláusula global
⚪ Aplicar cláusula global a todos:
    [Seleccionar cláusula ▼]   (catálogo completo)
⚪ Usar cláusulas ya vigentes en la póliza   (solo MAPFRE)
```

Default según contexto:
- Póliza tiene cláusulas vigentes en `polizas_clausulas_aplicadas` → "previa_existente" (MAPFRE) o ninguna.
- Sin cláusulas vigentes → "ninguna".

#### Sub-paso B: Cláusulas individuales (opcional, salteable)

Tabla con un dropdown de cláusula por asegurado. Default: ninguna. Se aplica adicional a la global.

### 8.4 Confirmación + auto-aprobación

`POST /api/polizas/solicitudes/{id}/confirmar` con `tipo_respuesta = ok | rechazada`.

Si `ok`:
1. Asegurados pasan a `activo` con `fecha_alta_efectiva = now()`.
2. Sistema detecta personas con `es_solicitud=1` entre los asegurados.
3. Si hay → modal en UI ofreciendo auto-aprobación masiva:

```
Solicitud confirmada — 3 asegurados activados

De estos, 2 son personas en solicitud pendiente. ¿Aprobarlos como distribuidores activos ahora?

☑ JUAN PEREZ
☑ ANA GOMEZ
(CARLOS LOPEZ ya estaba aprobado)

[No aprobar] [Aprobar 2 distribuidores]
```

4. Si admin aprueba → `personas` actualizada (`aprobado=1, es_solicitud=0, estado=Activo`).
5. Trigger automático: detección de "altas nuevas" para notificación al distribuidor (sección 9).

Si `rechazada`:
- Asegurados vuelven al estado anterior.
- Si previamente se hizo auto-aprobación, ofrecer "deshacer aprobación".

---

## 9. Notificación al distribuidor

### 9.1 Caso de uso

Cuando se confirma una solicitud de alta o se carga un PDF que da de alta nuevos distribuidores, el operador puede notificarles a ellos por email a su `personas.email`.

### 9.2 Detección de altas nuevas

```php
function detectar_altas_nuevas($poliza_id, $cambios_recientes) {
    $altas = [];
    foreach ($cambios_recientes as $a) {
        if ($a->estado_anterior IN ['no_existia', 'alta_solicitada']
            && $a->estado_actual == 'activo'
            && $a->persona_id
            && $a->persona->email) {
            $altas[] = $a;
        }
    }
    return $altas;
}
```

Casos donde NO se notifica:
- Sin `persona_id` (no matcheado)
- `personas.email` NULL o vacío
- Notificación duplicada (mismo asegurado, ya enviada)
- `polizas_notif_distribuidor_config.activo = FALSE` para esa póliza

### 9.3 Template default

```
Asunto: Alta en póliza {numero_poliza} - {aseguradora}

Hola {nombre_apellido},

Te informamos que fuiste dado de alta en la póliza de {ramo}
con la aseguradora {aseguradora}, póliza N° {numero_poliza},
con vigencia desde {fecha_alta_efectiva}.

Ya estás cubierto por la póliza. Si tenés alguna duda o querés más
información sobre las condiciones, escribinos a {email_admin}.

Saludos,
Logística Argentina S.R.L.
```

### 9.4 UI — modal post-carga / post-confirmación

```
Carga aplicada — 5 asegurados nuevos en {poliza}

¿Notificar a los distribuidores?

☑ Fillon Brian       fillon@email.com
☑ Gudiño Julio       gudino@email.com
☐ García Alejandro   (sin email)
☑ Lopez Carlos       lopez@email.com

Email a enviar (preview): [...]

[No notificar ahora] [Enviar 3 notificaciones]
```

### 9.5 Bandeja de notificaciones

`/polizas/notificaciones` con filtros estado / póliza / fecha. Soporta reenvío de rebotadas y notificaciones pendientes.

---

## 10. Integración con módulo Proveedores

### 10.1 Tab "Pólizas" en `/personal/:id/editar`

Muestra todas las pólizas en las que figura ese proveedor:

#### Si proveedor está Activo y Aprobado

```
Pólizas en las que figura:
- MAPFRE - AP OCASA · Activo desde 02/05/2026  [Solicitar baja]
- La Segunda - Vehículos Autos · IWK373 · Activo  [Solicitar baja]
```

#### Si proveedor está en Solicitud pendiente

```
Estado del proveedor: Solicitud pendiente

⚠ Para aprobar a este distribuidor como activo, primero hay que
   dar de alta en la póliza correspondiente:

Pólizas sugeridas según su perfil:
- MAPFRE - AP OCASA  [Solicitar alta]
- La Segunda - Vehículos Autos (patente ZUL050)  [Solicitar alta]
```

#### Si proveedor está en Baja o Suspendido pero figura activo en una póliza

```
⚠ Atención: este proveedor está {estado} desde {fecha} pero sigue activo en las siguientes pólizas:
- La Segunda - Vehículos Autos · IWK373  [Solicitar baja en póliza]
```

### 10.2 Endpoint `GET /api/personal/{id}/polizas-aplicables`

Sugerir qué pólizas podrían aplicar a esta persona según su perfil/cliente:

```json
{
  "data": [
    {"poliza_id": 1, "nombre": "MAPFRE - AP OCASA", "razon": "Persona con cliente OCASA"},
    {"poliza_id": 3, "nombre": "La Segunda - Vehículos Autos", "razon": "Persona con patente ZUL050"}
  ]
}
```

### 10.3 Categorización de archivos

Los archivos del proveedor pueden categorizarse con los slugs reservados (`foto_frente`, `cedula_frente`, etc.) para que el sistema los pueda adjuntar automáticamente al email cuando se solicite alta de La Segunda.

UI: dropdown al subir documento con las categorías disponibles.

---

## 11. Integración con CRM Aprobaciones/Solicitudes

### 11.1 Flujo bidireccional

```
1. Persona postula → CRM Aprobaciones (es_solicitud=1, aprobado=0)
2. Mati click "Solicitar alta en póliza" desde CRM
3. Wizard Pólizas con persona pre-seleccionada → email a aseguradora
4. Aseguradora confirma → Mati click "Confirmar respondida_ok"
5. Modal: "¿Aprobar distribuidor ahora?" → Mati elige
6. Si aprueba → persona pasa a aprobado=1, estado=Activo
7. Trigger auto: notificación al distribuidor
```

### 11.2 Acciones en CRM

#### Por fila

```
| ID  | Nombre              | ... | Acciones                              |
| 912 | Alberto Jacinto Celi| ... | 👁 ✏ [📋 Solicitar alta en póliza] 🗑 |
```

Click → redirige a `/polizas/solicitar-alta?persona_id={id}` con persona pre-cargada.

#### Acción masiva

```
☑ Seleccionados: 5
[Acciones masivas ▼]
  · Solicitar alta en póliza AP Acc. Personales
  · Solicitar alta en póliza Vehículos
  · Aprobar masivo
```

### 11.3 Tab "Solicitud de póliza" del CRM

Embebe la bandeja de `polizas_solicitudes` con un componente compartido `SolicitudesPolizasBandeja`. Misma vista que `/polizas/solicitudes`.

---

## 12. Permisos y administrativos

### 12.1 Permisos granulares

Tabla `polizas_admin_permisos` con flags:
- `puede_cargar_pdf`
- `puede_solicitar_alta`
- `puede_solicitar_baja`
- `puede_confirmar_respuesta`
- `puede_editar_email_config`
- `puede_gestionar_clausulas`
- `puede_notificar_distribuidores`
- `recibe_alertas_vencimiento`

### 12.2 Roles típicos

- **Admin Pólizas** — todos los flags en TRUE.
- **Operador Pólizas** — `puede_cargar_pdf`, `puede_solicitar_alta`, `puede_solicitar_baja`.
- **Auditor Pólizas** — solo lectura (todos los flags en FALSE).

### 12.3 Endpoint admin

```
POST /api/polizas/admins
{
  "user_id": 12,
  "puede_cargar_pdf": true,
  "puede_solicitar_alta": true,
  ...
}
```

---

## 13. Cron jobs

### 13.1 Alerta vencimiento

```bash
php artisan polizas:alertas-vencimiento
```

Diario. Notifica a usuarios con `recibe_alertas_vencimiento = TRUE` cuando una póliza está dentro de los `alerta_dias_antes_vencimiento` (default 15).

### 13.2 Recordatorio solicitudes pendientes

```bash
php artisan polizas:recordar-solicitudes-pendientes
```

Diario. Si una solicitud `enviado` lleva > 7 días sin respuesta, notifica al admin creador para que haga follow-up.

### 13.3 Recálculo estados asegurados

```bash
php artisan polizas:recalcular-estados-asegurados
```

Diario. Actualiza `polizas_asegurados.persona_estado_al_matchear` y `persona_alerta_estado` en base al estado actual de cada `personas`.

---

## 14. UI completa

### 14.1 Pantallas

| Path | Descripción |
|---|---|
| `/polizas` | Listado de pólizas con cards (4-6 cards activas) |
| `/polizas/:id` | Detalle con 6 tabs (Resumen, Asegurados, Discrepancias, Endosos, Solicitudes, Configuración) |
| `/polizas/:id/cargar-pdf` | Wizard 3 pasos (subir → preview → confirmar) con filtros y selección masiva en preview |
| `/polizas/:id/asegurados` | Tabla con paginado, filtros, selección múltiple |
| `/polizas/:id/discrepancias` | 4 sub-tabs (A/B/C/D) con filtros + export Excel |
| `/polizas/:id/solicitar-alta` | Wizard 4 pasos (selección → cláusulas → preview email → enviar) |
| `/polizas/:id/solicitar-baja` | Wizard 3 pasos (selección → preview → enviar) |
| `/polizas/:id/configuracion` | Email config + cláusulas vigentes + notificación distribuidor |
| `/polizas/solicitudes` | Bandeja de solicitudes con filtros |
| `/polizas/notificaciones` | Bandeja de notificaciones a distribuidores |
| `/polizas/clausulas` | CRUD del catálogo de cláusulas |
| `/polizas/admins` | CRUD de administrativos con permisos |

### 14.2 Listado de pólizas — destacar vencimientos

Pólizas dentro de los 15 días de vencer → fondo rojo en card.
Pólizas con discrepancias → badge ámbar con cantidad.

### 14.3 Wizard de carga PDF — preview robusto

Filtros y acciones por fila:
- Filtro por estado de match (exacto / sin match)
- Filtro por decisión (vincular / crear / ignorar)
- Búsqueda texto libre
- Selección múltiple con acción masiva (cambiar decisión / eliminar)
- Botón [✗] por fila para eliminar (no importar)
- Dropdown decisión por fila
- Sugerencia fuzzy se muestra como info pero no auto-vincula

### 14.4 Tab Discrepancias — 4 sub-tabs

```
A. Sin persona en sistema (12)              ← fantasmas
B. Personas activas sin póliza (5)          ← faltan dar de alta
C. Match dudoso (1)                         ← sugerencia fuzzy para revisión
D. Estado inconsistente (3)                 ← persona y póliza no coinciden
```

Sub-tabs internos en D:
- D1: Persona en baja en póliza activa
- D2: Persona suspendida en póliza activa
- D3: Persona en solicitud pendiente en póliza activa
- D4: Persona sin aprobar en póliza activa

### 14.5 Wizard solicitar alta — 4 pasos

```
1. Selección (búsqueda + filtros + selección múltiple)
2. Cláusulas (sub-paso A: global, sub-paso B: individuales opcional)
3. Preview email (con check de adjuntos para La Segunda)
4. Enviar
```

### 14.6 Wizard solicitar baja — 3 pasos

```
1. Selección (asegurados activos)
2. Preview email
3. Enviar
```

### 14.7 Componentes a reutilizar

- `PersonaPicker` (selector con búsqueda y badges de estado)
- `ArchivoUploader` (con categoría)
- `EstadoBadge`
- `EmailPreview` (formato cliente de email)
- `EmailTemplateEditor` (con placeholders + preview live)
- `AdjuntosCheck` (panel de validación de adjuntos)
- `DiscrepanciasReport` (4 sub-tabs)
- `SolicitudesPolizasBandeja` (componente compartido CRM ↔ Pólizas)

---

## 15. API REST endpoints

### 15.1 Pólizas

```
GET    /api/polizas
GET    /api/polizas/{id}
POST   /api/polizas
PUT    /api/polizas/{id}
DELETE /api/polizas/{id}                         (soft delete)
GET    /api/polizas/aseguradoras
GET    /api/polizas/dashboard/alertas
```

### 15.2 Asegurados

```
GET    /api/polizas/{id}/asegurados
GET    /api/polizas/{id}/asegurados?estado=activo
GET    /api/polizas/{id}/discrepancias
GET    /api/polizas/{id}/personas-disponibles-para-alta
```

### 15.3 Carga PDF

```
POST   /api/polizas/parse-pdf                     (microservicio Python)
POST   /api/polizas/{id}/cargar-pdf
POST   /api/polizas/{id}/confirmar-carga
GET    /api/polizas/{id}/endosos
```

### 15.4 Solicitudes

```
POST   /api/polizas/{id}/solicitudes
GET    /api/polizas/solicitudes
GET    /api/polizas/solicitudes/{id}
POST   /api/polizas/solicitudes/{id}/preview
POST   /api/polizas/solicitudes/{id}/enviar
POST   /api/polizas/solicitudes/{id}/confirmar
POST   /api/polizas/solicitudes/{id}/cancelar
```

Body de `/solicitudes`:

```json
{
  "tipo": "alta",
  "asegurados_ids": [...],
  "personas_ids_a_alta": [...],
  "tipo_clausula_global": "ninguna|aplicar|previa_existente",
  "clausula_global_id": null,
  "clausulas_individuales": [
    {"persona_id": 105, "clausula_id": 3}
  ]
}
```

### 15.5 Cláusulas

```
GET    /api/polizas/clausulas
POST   /api/polizas/clausulas
PUT    /api/polizas/clausulas/{id}
GET    /api/polizas/{id}/clausulas-vigentes
POST   /api/polizas/{id}/clausulas-aplicar
POST   /api/polizas/{id}/clausulas-remover
```

### 15.6 Notificación distribuidor

```
POST   /api/polizas/{id}/notificaciones-distribuidor/preview
POST   /api/polizas/{id}/notificaciones-distribuidor/enviar
GET    /api/polizas/notificaciones
POST   /api/polizas/notificaciones/{id}/reenviar
PUT    /api/polizas/{id}/notif-distribuidor-config
```

### 15.7 Configuración

```
PUT    /api/polizas/{id}/email-config/{tipo}
POST   /api/polizas/email-config/{id}/probar
```

### 15.8 Personal (cross-module)

```
GET    /api/personal/{id}/polizas
GET    /api/personal/{id}/polizas-aplicables
POST   /api/personal/aprobar-masivo
```

### 15.9 Admins

```
GET    /api/polizas/admins
POST   /api/polizas/admins
PUT    /api/polizas/admins/{id}
DELETE /api/polizas/admins/{id}
```

---

## 16. Criterios de aceptación

### 16.1 Modelo de datos

- [ ] Las 13 tablas creadas con sus FKs e índices.
- [ ] `archivos.categoria` agregado.
- [ ] Seed: 3 aseguradoras + 6 pólizas + 12 email_configs + 6 cláusulas.
- [ ] Soft delete de póliza no borra registros relacionados.

### 16.2 Parser

- [ ] **MAPFRE Constancia** (`05_MAPFRE_CertEndoso_28.pdf`) → 88 asegurados, identificadores DU/CL correctamente clasificados.
- [ ] **MAPFRE Endoso** (`04_MAPFRE_Endoso_28.pdf`) → tipo correcto + datos parseados.
- [ ] **SC Frente de Endoso 47** (`03_SanCristobal_FrenteEndoso_47.pdf`) → 3 incorporaciones con N° + CUIL + nombre + fecha nac + ocupación.
- [ ] **SC Anexo de Adherentes 30034667** → 2 asegurados (Fillon, Gudiño).
- [ ] **SC Anexo de Adherentes 30035710** → ~700 asegurados de 26 páginas.
- [ ] **La Segunda Autos** (`01_LaSegunda_Autos_*.pdf`) → 23 vehículos con patente, año, marca, tipo.
- [ ] **La Segunda Motos** (`02_LaSegunda_Motos_*.pdf`) → 8 motos con `tipo_vehiculo='MOTO'`.
- [ ] Auto-detección de aseguradora por header funciona en los 8 PDFs.
- [ ] Patentes normalizadas (uppercase, sin espacios).

### 16.3 Matching

- [ ] **Caso OPT548:** patente OPT548 matchea con persona Eduardo Matias Intile (#698, Suspendido) — no aparece como "sin match".
- [ ] **Caso BRIZUELA MIGUEL EDUARDO:** NO se vincula automáticamente con persona #800. Aparece como "sin match" + sugerencia visual de #800 con CUIL distinto.
- [ ] Match exacto por CUIL funciona — caso Yacob (`20316758267`) matchea con persona si existe.
- [ ] Match por DNI extraído del CUIL funciona.
- [ ] Match por patente contra `personas.patente` y `persona_patentes.patente`.
- [ ] **Sin match fuzzy automático.** Solo CUIL/DNI/patente exactos.
- [ ] Personas en baja, suspendidas, en solicitud, sin aprobar → SÍ son matcheadas.
- [ ] `persona_alerta_estado` se calcula y persiste correctamente.

### 16.4 Discrepancias

- [ ] Endpoint `/discrepancias` devuelve 4 categorías (A, B, C, D).
- [ ] Categoría D tiene 4 sub-tipos (D1-D4).
- [ ] Filtros funcionan: categoría, sucursal, cliente, antigüedad, búsqueda.
- [ ] Subpestaña "Personas en póliza pero NO en plataforma" con vista enfocada.
- [ ] Export Excel funciona.
- [ ] Acción "Vincular" desde A abre buscador.
- [ ] Acción "Pedir baja en póliza" desde D1 (persona baja) genera solicitud.

### 16.5 Cláusulas

- [ ] Catálogo seed con 6 cláusulas + campo `alias`.
- [ ] CRUD de cláusulas funcional desde `/polizas/clausulas`.
- [ ] Wizard "Solicitar alta" muestra paso 2 "Cláusulas" en TODAS las aseguradoras.
- [ ] **Estilo MAPFRE:** cláusula inline `(Con clausula de Ocasa CUIT N 30 66204961 8)` después del nombre.
- [ ] **Estilo MAPFRE referencia previa:** body contiene "Por favor, incluir las mismas cláusulas que figuran en endosos anteriores...".
- [ ] **Estilo SC global:** body contiene línea `-(Con clausula de...)` arriba del listado y "Informa nuevas altas EN ÍDEM CONDICIONES...".
- [ ] **Estilo SC individual:** asegurado específico tiene cláusula inline.
- [ ] **Estilo La Segunda:** body contiene "Solicito que el seguro de La Segunda tenga las cláusulas de {alias} por favor."
- [ ] Numeración `1)_:`, `2)_:` se aplica en TODAS las altas SC.
- [ ] Bajas SC siguen con CUIL sin guiones (sin numeración).

### 16.6 Solicitudes

- [ ] **Solicitar alta** muestra personas que NO son asegurados activos en la póliza, con badges de estado.
- [ ] **Solicitar baja** muestra solo asegurados activos.
- [ ] La Segunda Autos Alta con 5 fotos categorizadas → email con adjuntos.
- [ ] La Segunda Autos Alta sin las 5 fotos → bloqueo + mensaje de qué falta.
- [ ] La Segunda Autos Alta con N vehículos → forzar N solicitudes independientes.
- [ ] Confirmar `respondida_ok` con personas en `es_solicitud=1` → modal auto-aprobación.
- [ ] Confirmar `respondida_rechazada` revierte estados.
- [ ] `polizas_solicitudes.email_message_id` poblado tras envío SMTP.

### 16.7 Notificación al distribuidor

- [ ] Después de carga con altas → modal pregunta "¿Notificar?"
- [ ] Asegurados sin email aparecen deshabilitados con etiqueta "sin email".
- [ ] Envío usa SMTP institucional con `Reply-To` = email del admin.
- [ ] `polizas_notificaciones_distribuidor` registra estado correcto (enviado/rebotado/sin_email).
- [ ] Bandeja `/polizas/notificaciones` permite reenvío.
- [ ] Template editable por póliza desde configuración.

### 16.8 Integración Proveedores

- [ ] Tab "Pólizas" en `/personal/:id/editar` muestra todas las pólizas activas.
- [ ] Proveedor en solicitud pendiente → tab muestra "Solicitar alta en póliza".
- [ ] Proveedor en baja con cobertura activa → tab muestra alerta + "Solicitar baja en póliza".
- [ ] Endpoint `/personal/{id}/polizas-aplicables` devuelve sugerencias correctas.

### 16.9 Integración CRM Aprobaciones

- [ ] CRM Aprobaciones tiene acción "Solicitar alta en póliza" por fila.
- [ ] CRM Aprobaciones tiene acción masiva con selección múltiple.
- [ ] Click → redirige al wizard con persona(s) pre-cargada(s).
- [ ] Tab "Solicitud de póliza" del CRM muestra bandeja embebida.

### 16.10 Permisos

- [ ] Usuario sin `puede_cargar_pdf` no ve botón "Cargar PDF".
- [ ] Endpoints rechazan request con 403 si falta permiso.
- [ ] Auditor (todos los flags FALSE) puede ver pero no editar.

### 16.11 Cron jobs

- [ ] `polizas:alertas-vencimiento` corre y notifica con anticipación de 15 días.
- [ ] `polizas:recordar-solicitudes-pendientes` notifica solicitudes >7 días sin respuesta.
- [ ] `polizas:recalcular-estados-asegurados` actualiza alertas de estado.

### 16.12 Smoke test E2E

- [ ] **Test 1 — Carga MAPFRE:** Subir Constancia → 88 asegurados → 3 fantasmas → reporte.
- [ ] **Test 2 — Solicitud baja MAPFRE:** Pedir baja de 2 fantasmas → email correcto → confirmar → asegurados en `dado_de_baja`.
- [ ] **Test 3 — Carga SC Anexo Adherentes:** Subir → asegurados parseados con `fecha_alta_efectiva`.
- [ ] **Test 4 — Carga La Segunda Autos:** Subir → vehículos parseados → discrepancias detectadas → enviar baja de 1 → email correcto → confirmar.
- [ ] **Test 5 — Alta desde CRM:** Tomar Alberto Jacinto Celi (#912 en solicitud) → "Solicitar alta" → wizard pre-cargado → completar flujo → modal aprobación → persona pasa a Activo.
- [ ] **Test 6 — Cláusulas SC con global + individual:** 5 asegurados con cláusula global OCASA + 1 con individual adicional → email renderizado correcto con `-(...)` arriba y inline en uno.
- [ ] **Test 7 — La Segunda Alta con cláusula:** Adjuntar las 5 fotos → solicitar alta con cláusula OCA → email contiene "tenga las cláusulas de OCA por favor" + adjuntos.
- [ ] **Test 8 — Notificación distribuidor:** Confirmar alta → modal "¿Notificar?" → enviar → email llega al distribuidor.

---

## Final

Documento listo para implementación end-to-end. Cualquier duda durante el desarrollo, consultar.
