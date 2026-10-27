# Destino del carbono · React Flow

Versión 1.0.13: recoloca la línea de activación de SPS por G6P para que no quede tapada por la tarjeta de fructosa-1,6-bisfosfatasa. Conserva los casos fisiológicos, las concentraciones cualitativas y la degradación nocturna del almidón de la versión anterior.

Aplicación didáctica interactiva para estudiar la partición del carbono entre sacarosa y almidón. El mapa utiliza React Flow y un modelo continuo interno de regulación metabólica.

## Ejecutar

```bash
pnpm install
pnpm dev
```

## Compilar

```bash
pnpm build
```

La carpeta `dist/` puede publicarse directamente. El proyecto utiliza rutas relativas (`base: './'`).

### GitHub Pages

El proyecto incluye un flujo de GitHub Actions. En el repositorio, selecciona **Settings → Pages → Source → GitHub Actions** y sube el contenido a la rama `main`.

## Casos fisiológicos

No hay deslizadores ni modo de exploración libre. El lateral permite escoger:

- día con carga floemática normal, alta, baja o cerrada;
- noche temprana o avanzada;
- limitación de Pi.

Cada caso fija internamente iluminación, carga floemática, depósito de fosfato, distribución inicial de Pi y triosas-P, y reserva de almidón. El cálculo sigue siendo cuantitativo y continuo, pero la concentración visible se compara con el día basal y se traduce a cinco categorías:

- `↓↓`: muy baja (≤55 % de la referencia);
- `↓`: baja (56–80 %);
- sin flecha: normal (81–120 %);
- `↑`: alta (121–160 %);
- `↑↑`: muy alta (>160 %).

Las actividades enzimáticas conservan una escala continua de 0–100 %, con color y barra. Las reacciones favorecidas aumentan de grosor; las casi bloqueadas se muestran finas y discontinuas.

## Día, noche y reservas

Durante el día existe producción de fotoasimilados. Al disminuir la carga floemática se acumula sacarosa, aumenta su retroinhibición sobre SPS y cambia el reparto hacia la reserva.

Durante la noche la fijación de CO₂ es cero. El suministro procede de la degradación del almidón y se representa mediante maltosa y glucosa. La noche temprana conserva una reserva y un flujo de movilización altos; en la noche avanzada ambos disminuyen.

## Fosfato y TPT

El fosfato intercambiable se distribuye entre Pi citosólico, Pi estromático, triosas-P citosólicas y triosas-P estromáticas. Sus fracciones internas suman el 100 %. El TPT intercambia una triosa-P y un Pi en sentidos opuestos, sin control manual de velocidad y sin crear ni destruir fosfato.

La dirección se calcula a partir del desequilibrio `TPest·Picit − TPcit·Piest`. Una extensión positiva exporta triosa-P al citosol e introduce Pi en el estroma; una negativa invierte ambos movimientos.

El Pi se repite como nodos locales junto a SPS, F6P-2-quinasa, F2,6BPasa y AGPasa. Son alias gráficos sincronizados, no depósitos adicionales. Los globos se han ampliado y usan la misma flecha cualitativa que el nodo principal.

## Regulación y lectura

Pi, G6P, F2,6BP, sacarosa, triosas-P y 3-PGA modifican continuamente las actividades enzimáticas. Cuando dos reguladores ejercen efectos antagónicos, el mapa destaca la señal dominante. Al pasar el cursor por una enzima aparece una explicación cualitativa de por qué está activa, limitada o reprimida.

La respuesta de F2,6BP está deliberadamente exagerada como recurso didáctico. El lienzo no captura el desplazamiento vertical en la vista completa; se activa al ampliar el mapa.

## Referencia experimental

La interfaz conserva los valores de Szecowka et al. (2013, *The Plant Cell*, DOI `10.1105/tpc.112.106989`), obtenidos mediante marcaje de rosetas iluminadas con 13CO₂: síntesis de sacarosa de 7,11 y de almidón de 3,19 nmol de C g⁻¹ de peso fresco s⁻¹, relación 2,2:1; DHAP distribuido 77 % en citosol y 23 % en plastidio.

## Alcance científico

El modelo usa unidades relativas y estados estacionarios didácticos. No incluye ATP/ADP, PPi, respiración, fotorespiración ni todos los azúcares fosfato. No es un modelo cinético calibrado y las flechas expresan cambios relativos, no concentraciones absolutas.
