# Destino del carbono · React Flow

Versión 1.0.8: incorpora un control de triosas-P citosólicas acoplado al Pi mediante el TPT, bloquea el desplazamiento del lienzo mientras se muestra el encuadre completo y añade una referencia cuantitativa experimental de Arabidopsis. También fuerza un nuevo ajuste del mapa al inicializar React Flow para evitar un lienzo vacío.

> Nota: el activador de la sacarosa-fosfato sintasa mostrado en el esquema es G6P (glucosa-6-fosfato), no G1P.

Aplicación didáctica interactiva para estudiar la partición del carbono fotosintético entre sacarosa y almidón. El mapa se representa con React Flow y componentes bioquímicos propios.

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

El proyecto incluye un flujo de GitHub Actions. En el repositorio, selecciona **Settings → Pages → Source → GitHub Actions** y sube el contenido a la rama `main`. Cada cambio en `main` volverá a compilar y publicar la aplicación.

## Interacción y balances

Los cuatro deslizadores representan la carga floemática, el tamaño del depósito de fosfato intercambiable, la cuota celular de Pi citosólico y las triosas-P citosólicas. La fijación de CO₂ no se ajusta: se mantiene constante en los escenarios diurnos. Al reducir la carga floemática se acumula sacarosa y aumenta su retroinhibición sobre SPS.

El fosfato intercambiable se distribuye entre Pi citosólico, Pi estromático, triosas-P citosólicas y triosas-P estromáticas. Sus fracciones suman siempre el 100 %. Al aumentar la cuota de Pi citosólico disminuyen simultáneamente las otras tres fracciones. El TPT mueve una triosa-P y un Pi en sentidos opuestos, sin crear ni destruir fosfato.

El control de triosa-P citosólica modifica el reparto inicial entre ambos compartimentos. Después, el TPT recalcula conjuntamente las cuatro fracciones: una acumulación suficiente de TP en el citosol favorece su retorno al estroma y la entrada compensatoria de Pi al citosol.

La dirección del TPT se obtiene del desequilibrio `TPest·Picit − TPcit·Piest`. Una extensión positiva exporta triosa-P al citosol e introduce Pi en el estroma; una extensión negativa realiza el intercambio contrario. No existe un control manual de velocidad: el intercambio se orienta automáticamente y queda limitado únicamente por los sustratos disponibles. Después del transporte se recalculan todas las concentraciones y actividades enzimáticas.

El lienzo no captura el desplazamiento vertical en su vista completa. El desplazamiento y arrastre se activan únicamente después de ampliar el mapa mediante los controles de zoom o un gesto de pellizco.

## Referencia experimental

La interfaz incluye valores de Szecowka et al. (2013, *The Plant Cell*, DOI `10.1105/tpc.112.106989`), obtenidos mediante marcaje de rosetas iluminadas con 13CO₂: síntesis de sacarosa de 7,11 y de almidón de 3,19 nmol de C g⁻¹ de peso fresco s⁻¹, relación 2,2:1; DHAP de 2,7 ± 0,6 nmol g⁻¹, distribuido 77 % en citosol y 23 % en plastidio. El estudio trata DHAP y 3-PGA de ambos compartimentos como depósitos en rápido equilibrio isotópico por el TPT, pero no ofrece un único flujo neto de TPT directamente utilizable para calibrar este simulador.

El carbono fijado se reparte entre sacarosa exportada, almidón almacenado y carbono soluble retenido. Estas tres fracciones también se normalizan para sumar el 100 % del carbono entrante. La salida al floema se trata como demanda o flujo, no como concentración; el depósito interno de sacarosa se calcula por separado.

Cada cambio actualiza:

- el color y porcentaje de los metabolitos;
- la actividad de las enzimas;
- el grosor de los flujos metabólicos;
- las activaciones e inhibiciones dependientes de umbrales;
- la dirección neta del antiporte TPT, representado mediante dos únicas flechas continuas y opuestas: una para triosas-P y otra para Pi.

Para evitar interpretar como simultáneamente dominantes señales opuestas, SPS, F6P-2-quinasa y AGPasa muestran una sola línea reguladora: la de mayor intensidad relativa, ponderada por el coeficiente o umbral con el que actúa en el modelo. El regulador visible puede cambiar al mover un deslizador o seleccionar otro escenario. Las señales menores no desaparecen del modelo matemático; únicamente se ocultan del mapa.

La sección **Casos fisiológicos** incorpora siete estados predefinidos: día basal, carga floemática alta, cierre de carga, noche, Pi alto en citosol, Pi bajo en citosol y acumulación de triosas-P. Al modificar manualmente cualquier deslizador se activa la exploración libre.

El mapa separa los compartimentos citosólico y cloroplástico. Las etapas dirigidas se dibujan como metabolito → proceso → metabolito; en las interconversiones, la enzima aparece junto a las flechas antiparalelas. Las activaciones terminan en punta de flecha verde y las inhibiciones en barra perpendicular roja.

Las interconversiones mediante PGI, PGM, UGPasa y aldolasa se representan mediante dos flechas antiparalelas. Sus grosores independientes muestran la preferencia relativa de cada sentido. El ciclo F6P/F2,6BP también utiliza dos flechas porque la síntesis y la hidrólisis dependen de enzimas diferentes. Las etapas SPS, SPP, FBPasa, AGPasa y formación de almidón permanecen dirigidas.

Las regulaciones de largo alcance se conducen por corredores exteriores al mapa metabólico para evitar atravesar metabolitos o enzimas. Cada activador o inhibidor llega a un puerto distinto de la tarjeta enzimática; un halo claro separa cruces y mantiene visibles las puntas de activación y las barras de inhibición.

## Alcance científico

El modelo utiliza unidades relativas y representa un estado estacionario didáctico. Conserva dos presupuestos normalizados —fosfato intercambiable y carbono fijado—, pero no incluye ATP/ADP, PPi, respiración, fotorespiración ni todos los azúcares fosfato. F2,6BP se calcula mediante un balance simplificado entre F6P-2-quinasa y F2,6BPasa. La aplicación no es un modelo cinético calibrado experimentalmente.
