# Destino del carbono · React Flow

Versión 1.0.3: revisión de legibilidad, regulación y antiporte TPT. El transportador se aplica como una redistribución estequiométrica real: cada triosa-P transportada obliga al movimiento de un Pi de igual magnitud en sentido contrario.

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

Los cinco deslizadores representan condiciones externas: fijación de carbono, demanda del floema, tamaño del depósito de fosfato intercambiable, distribución del Pi libre y capacidad del TPT. Las concentraciones internas se calculan como resultados del modelo.

El fosfato intercambiable se distribuye entre Pi citosólico, Pi estromático, triosas-P citosólicas y triosas-P estromáticas. Sus fracciones suman siempre el 100 %. El TPT mueve una triosa-P y un Pi en sentidos opuestos, sin crear ni destruir fosfato.

La dirección del TPT se obtiene del desequilibrio `TPest·Picit − TPcit·Piest`. Una extensión positiva exporta triosa-P al citosol e introduce Pi en el estroma; una extensión negativa realiza el intercambio contrario. La extensión está limitada por la capacidad del TPT y por el menor de los dos sustratos disponibles. Después del transporte se recalculan todas las concentraciones y actividades enzimáticas.

El carbono fijado se reparte entre sacarosa exportada, almidón almacenado y carbono soluble retenido. Estas tres fracciones también se normalizan para sumar el 100 % del carbono entrante. La salida al floema se trata como demanda o flujo, no como concentración; el depósito interno de sacarosa se calcula por separado.

Cada cambio actualiza:

- el color y porcentaje de los metabolitos;
- la actividad de las enzimas;
- el grosor de los flujos metabólicos;
- las activaciones e inhibiciones dependientes de umbrales;
- la dirección neta del antiporte TPT, representado mediante dos únicas flechas continuas y opuestas: una para triosas-P y otra para Pi.

La sección **Casos fisiológicos** incorpora seis estados predefinidos: equilibrio basal, exportación sostenida al floema, interrupción de la exportación, acumulación de Pi citosólico, acumulación de Pi estromático y fijación alta con baja demanda del sumidero. Al modificar manualmente cualquier deslizador se activa la exploración libre.

El mapa separa los compartimentos citosólico y cloroplástico. Las etapas dirigidas se dibujan como metabolito → proceso → metabolito; en las interconversiones, la enzima aparece junto a las flechas antiparalelas. Las activaciones terminan en punta de flecha verde y las inhibiciones en barra perpendicular roja.

Las interconversiones mediante PGI, PGM, UGPasa y aldolasa se representan mediante dos flechas antiparalelas. Sus grosores independientes muestran la preferencia relativa de cada sentido. El ciclo F6P/F2,6BP también utiliza dos flechas porque la síntesis y la hidrólisis dependen de enzimas diferentes. Las etapas SPS, SPP, FBPasa, AGPasa y formación de almidón permanecen dirigidas.

Las regulaciones de largo alcance se conducen por corredores exteriores al mapa metabólico para evitar atravesar metabolitos o enzimas. Las líneas cortas de catálisis local permanecen junto a la reacción correspondiente.

## Alcance científico

El modelo utiliza unidades relativas y representa un estado estacionario didáctico. Conserva dos presupuestos normalizados —fosfato intercambiable y carbono fijado—, pero no incluye ATP/ADP, PPi, respiración, fotorespiración ni todos los azúcares fosfato. F2,6BP se calcula mediante un balance simplificado entre F6P-2-quinasa y F2,6BPasa. La aplicación no es un modelo cinético calibrado experimentalmente.
