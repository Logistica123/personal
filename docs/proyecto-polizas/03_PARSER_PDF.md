# Parser PDF — Especificación detallada

> Microservicio Python: `/api/polizas/parse-pdf` (similar al de OCASA `/api/ocasa/parse-pdf`)

---

## 1. Endpoint

```
POST /api/polizas/parse-pdf
Headers: multipart/form-data
Body: file=<PDF>
```

### Response

```json
{
  "aseguradora_detectada": "MAPFRE" | "SAN_CRISTOBAL" | "LA_SEGUNDA" | null,
  "tipo_documento": "constancia" | "endoso_incorporacion" | "endoso_baja" | "endoso_modificacion",
  "poliza": {
    "numero_poliza": "...",
    "numero_cuenta_cliente": null | "...",
    "vigencia_desde": "YYYY-MM-DD",
    "vigencia_hasta": "YYYY-MM-DD",
    "tomador_cuit": "...",
    "tomador_razon_social": "...",
    "tomador_domicilio": "...",
    "suma_asegurada_total": null | float,
    "premio_anual": null | float
  },
  "endoso": {
    "numero_endoso": null | "...",
    "fecha_emision": null | "YYYY-MM-DD",
    "tipo": "incorporacion" | "baja" | "modificacion" | "constancia",
    "descripcion": null | "...",
    "premio_endoso": null | float
  },
  "asegurados": [
    {
      "tipo": "persona" | "vehiculo",
      "identificador": "...",        // DNI/CUIL/Patente
      "identificador_tipo": "dni" | "cuil" | "patente",
      "numero_orden_aseguradora": null | "...",
      "nombre_apellido": null | "...",
      "fecha_nacimiento": null | "YYYY-MM-DD",
      "ocupacion": null | "...",     // SC
      "marca_modelo": null | "...",  // La Segunda
      "tipo_vehiculo": null | "...", // La Segunda: MOTO|CAMIONES|...
      "año": null | int,             // La Segunda
      "localidad": null | "...",     // La Segunda
      "suma_asegurada": null | float,
      "premio_individual": null | float
    }
  ],
  "warnings": ["..."]
}
```

---

## 2. Auto-detección de aseguradora

Al recibir el PDF, leer las primeras 3 páginas como texto y aplicar regex en orden:

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

Si retorna `None`, devolver error `400 — Aseguradora no detectada` y dejar que el admin la elija manualmente con un dropdown en la UI.

---

## 3. Perfil MAPFRE

### Tipos de documento

- **Constancia de Cobertura** (ej: `05_MAPFRE_CertEndoso_28.pdf`) — listado completo de vidas vigentes.
- **Endoso/Suplemento** (ej: `04_MAPFRE_Endoso_28.pdf`) — modificaciones del período.

### Datos de póliza

```python
# Búsqueda en página 1
patterns = {
    'numero_poliza': r'Póliza N°\s*:\s*(\d+)',
    'vigencia_desde': r'Vigencia desde el (\d{2}/\d{2}/\d{4})',
    'vigencia_hasta': r'hasta el (\d{2}/\d{2}/\d{4})',
    'tomador_cuit': r'CUIT/CUIL/DU:\s*(\d+)',
    'tomador_razon_social': r'Tomador:\s*([^\n]+)',
    'plan': r'Plan:\s*([^\n]+)',
    'vidas_vigentes': r'Vidas vigentes:\s*(\d+)',
    'suma_asegurada_total': r'MUERTE E INCAPACIDAD\s*-\s*\$\s*([\d,\.]+)',
    'asistencia_medica': r'ASISTENCIA MEDICO FARMACEUTICA\s*-\s*\$\s*([\d,\.]+)',
}
```

### Asegurados (Constancia)

Formato:
```
DU 36193874 ACEVEDO LUIS ALBERTO
DU 25016089 AGUILAR JORGE ANDRES
CL 20217198365 CANETE GUSTAVO JAVIER   ← CL = CUIL (cuando no hay DU)
```

Regex por línea:
```python
RE_MAPFRE_LINEA = re.compile(
    r'^(DU|CL)\s+(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)$',
    re.MULTILINE
)
```

Procesamiento:
```python
for tipo, numero, nombre in matches:
    asegurado = {
        'tipo': 'persona',
        'identificador': numero,
        'identificador_tipo': 'dni' if tipo == 'DU' else 'cuil',
        'nombre_apellido': nombre.strip(),
    }
    asegurados.append(asegurado)
```

### Asegurados (Endoso de incorporación/baja MAPFRE)

Formato distinto al de la constancia — buscar bloques con encabezado:
```
ALTAS:
  Apellido y Nombre: PEREZ JUAN
  DNI: 30123456
  Fecha de Nacimiento: 15/03/1980
```

Regex:
```python
RE_MAPFRE_ALTA_BLOCK = re.compile(
    r'Apellido y Nombre:\s*([^\n]+).*?'
    r'DNI:\s*(\d+).*?'
    r'Fecha de Nacimiento:\s*(\d{2}/\d{2}/\d{4})',
    re.DOTALL
)
```

---

## 4. Perfil San Cristóbal

### Tipos de documento

- **Frente de Endoso** (ej: `03_SanCristobal_FrenteEndoso_47.pdf`) — incorporaciones/bajas.
- **Constancia** (no incluida en muestra) — listado completo.

### Datos de póliza

```python
patterns = {
    'numero_poliza': r'N°\s*PÓLIZA\s*/\s*N°\s*FACTURA[\s\S]*?(\d{2}-\d{2}-\d{2}-\d{8})',
    'numero_cuenta': r'N°\s*cuenta:\s*(\d{2}-\d{8})',  # cuando aparece
    'vigencia_desde': r'VIGENCIA DESDE[\s\S]*?(\d{2}/\d{2}/\d{4})',
    'vigencia_hasta': r'VIGENCIA HASTA[\s\S]*?(\d{2}/\d{2}/\d{4})',
    'tomador': r'TOMADOR\s+([A-Z\sÁÉÍÓÚÑ]+?)\s+',
    'tomador_cuit': r'C\.U\.I\.T\.\s*(\d{2}-\d{8}-\d)',
    'numero_endoso': r'ENDOSO\s+(\d+)',
    'fecha_emision': r'FECHA EMISIÓN[\s\S]*?(\d{2}/\d{2}/\d{4})',
    'subramo': r'SUBRAMO\s+([^\n]+)',
    'suma_asegurada': r'Suma Asegurada Total\s*\$\s*([\d\.\,]+)',
    'premio': r'Premio\s*\$\s*([\d\.\,]+)',
}
```

### Detección de tipo de endoso

Buscar bloques con encabezado:
```
Incorporación de Asegurados   →  tipo='incorporacion'
Anulación de Asegurados / Bajas →  tipo='baja'
Otras Modificaciones             →  tipo='modificacion'
```

### Asegurados (Endoso incorporación)

Formato:
```
N°  APELLIDO Y NOMBRE        CUIL              FECHA DE NACIMIENTO  OCUPACIÓN
412 Yacob Jorge Dario        20-31675826-7     17/07/1985           chofer ómnibus...
413 Marolo Eva Gabriela      27-26787470-6     09/10/1978           chofer...
```

Regex:
```python
RE_SC_LINEA = re.compile(
    r'^(\d+)\s+'                                    # N°
    r'([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)\s+'                # Apellido y Nombre
    r'(\d{2}-\d{8}-\d)\s+'                          # CUIL
    r'(\d{2}/\d{2}/\d{4})\s+'                       # Fecha nac.
    r'(.+?)$',                                       # Ocupación
    re.MULTILINE
)
```

---

## 5. Perfil La Segunda

### Tipos de documento

- **Certificado de Cobertura y Libre Deuda** — listado de vehículos (ej: `01_LaSegunda_Autos_*.pdf` y `02_LaSegunda_Motos_*.pdf`).

### Identificación del tipo de póliza (autos vs motos)

Por el header:
- `Póliza para el seguro de vehículos automotores y/o remolcados` → **Autos**
- `Póliza para el seguro de motovehículos` → **Motos**

O por el número de póliza:
- `67.743.063` → Autos
- `45.597.407` → Motos

### Datos de póliza

```python
patterns = {
    'numero_poliza': r'(\d{2}\.\d{3}\.\d{3})',        # 67.743.063
    'vigencia_desde': r'desde las 12h del[\s\S]*?(\d{2}/\d{2}/\d{4})',
    'vigencia_hasta': r'hasta las 12h del[\s\S]*?(\d{2}/\d{2}/\d{4})',
    'tomador_cuit': r'C\.U\.I\.T\.?\s*(\d{11})',
    'tomador_domicilio': r'(?:AVENIDA|AV\.|CALLE)[^\n]+',
    'fecha_certificado': r'a la fecha\s+(\d{2}/\d{2}/\d{4})',
}
```

### Asegurados (vehículos)

Formato (encabezado de tabla):
```
N° Plan Patente Año Tipo Vehículo Uso GNC ...
   Marca / Version / Modelo  Localidad Suma Riesgo Asegurada Accesorios ...
```

Cada vehículo ocupa 1-2 líneas:
```
1 Ignis L2 (ex 34) IWK373 ATEGO 1418-48 2009 CAMIONES SEMI-PESADOS COMERCIAL LARGA ...
                                                                    SAN CAYETANO
```

Por la complejidad del layout multi-línea, **usar `pdfplumber.extract_tables()`** en lugar de regex sobre texto plano:

```python
import pdfplumber

with pdfplumber.open(file) as pdf:
    asegurados = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            # La tabla "Detalle de vehículos" tiene encabezados estables.
            # Detectar por el header: "N° | Plan | Patente | Año | ..."
            for row in table[1:]:  # skip header
                if not row[0] or not row[0].strip().isdigit():
                    continue
                vehiculo = {
                    'tipo': 'vehiculo',
                    'identificador': normalizar_patente(row[2]),  # IWK373
                    'identificador_tipo': 'patente',
                    'numero_orden_aseguradora': row[0],            # 1
                    'nombre_apellido': None,
                    'marca_modelo': row[3] or row[4],              # ATEGO 1418-48
                    'tipo_vehiculo': row[5],                       # CAMIONES SEMI-PESADOS / MOTO
                    'año': int(row[6]) if row[6] else None,
                    'localidad': row[7],
                    'suma_asegurada': parse_money(row[8]),
                    'premio_individual': parse_money(row[-2]),
                }
                asegurados.append(vehiculo)
```

> **Nota:** las tablas de La Segunda tienen layout complejo con headers que pueden variar levemente. Conviene desarrollar el parser con los 2 PDFs de muestra (Autos y Motos) y ajustar el mapeo de columnas viendo `table[0]` (primera fila = headers).

### Normalización de patente

```python
def normalizar_patente(p):
    return p.upper().replace(' ', '').replace('-', '').strip()
```

---

## 6. Helpers comunes

```python
def parse_money(s):
    """ '$53.800.000' → 53800000.0 """
    if not s:
        return None
    s = re.sub(r'[\$\.\s]', '', s)
    s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None

def parse_date(s):
    """ '23/01/2026' → '2026-01-23' """
    return datetime.strptime(s, '%d/%m/%Y').strftime('%Y-%m-%d')

def normalizar_cuil(c):
    """ '20-31675826-7' → '20316758267' """
    return re.sub(r'\D', '', c)

def extraer_dni_del_cuil(cuil):
    """ '20-31675826-7' → '31675826' """
    digitos = normalizar_cuil(cuil)
    if len(digitos) == 11:
        return digitos[2:10]
    return None
```

---

## 7. Tests sugeridos

Para cada perfil, fixtures con los PDFs de `ejemplos_pdfs/`:

```python
def test_la_segunda_autos():
    result = parse_pdf('ejemplos_pdfs/01_LaSegunda_Autos_CertCobertura.pdf')
    assert result['aseguradora_detectada'] == 'LA_SEGUNDA'
    assert result['poliza']['numero_poliza'] == '67.743.063'
    assert result['poliza']['vigencia_desde'] == '2026-01-23'
    assert result['poliza']['vigencia_hasta'] == '2027-01-23'
    assert any(a['identificador'] == 'IWK373' for a in result['asegurados'])

def test_la_segunda_motos():
    result = parse_pdf('ejemplos_pdfs/02_LaSegunda_Motos_CertCobertura.pdf')
    assert result['aseguradora_detectada'] == 'LA_SEGUNDA'
    assert result['poliza']['numero_poliza'] == '45.597.407'
    assert all(a['tipo_vehiculo'] == 'MOTO' for a in result['asegurados'])

def test_san_cristobal_endoso():
    result = parse_pdf('ejemplos_pdfs/03_SanCristobal_FrenteEndoso_47.pdf')
    assert result['aseguradora_detectada'] == 'SAN_CRISTOBAL'
    assert result['endoso']['numero_endoso'] == '118'
    assert result['endoso']['tipo'] == 'incorporacion'
    asegurados = result['asegurados']
    assert any(a['identificador'] == '20-31675826-7' and a['nombre_apellido'].startswith('Yacob')
               for a in asegurados)

def test_mapfre_constancia():
    result = parse_pdf('ejemplos_pdfs/05_MAPFRE_CertEndoso_28.pdf')
    assert result['aseguradora_detectada'] == 'MAPFRE'
    assert result['poliza']['numero_poliza'] == '1520222860404'
    assert len(result['asegurados']) == 88
```

---

## 8. Manejo de errores

| Error | Código | Mensaje |
|---|---|---|
| PDF no parseable | 400 | "PDF corrupto o no legible" |
| Aseguradora no detectada | 400 | "Aseguradora no identificada — seleccionar manualmente" |
| Sin asegurados encontrados | 200 con warning | "No se encontraron asegurados en el PDF" |
| Múltiples N° de póliza | 200 con warning | "PDF contiene múltiples pólizas — verificar" |

Los warnings se incluyen en `response.warnings[]` para que el admin los vea en el preview.
