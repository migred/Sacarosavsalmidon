# Destino del carbono · React Flow

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

## Interacción

Los cinco deslizadores controlan la salida de sacarosa y los balances Pi/triosas-P de citosol y estroma. Los dos pares Pi/triosas-P son inversos y suman siempre 100 %. Cada cambio actualiza:

- el color y porcentaje de los metabolitos;
- la actividad de las enzimas;
- el grosor de los flujos metabólicos;
- las activaciones e inhibiciones dependientes de umbrales;
- la dirección neta del antiporte TPT, representado mediante dos únicas flechas continuas y opuestas: una para triosas-P y otra para Pi.

La sección **Casos fisiológicos** incorpora seis estados predefinidos: equilibrio basal, exportación sostenida al floema, interrupción de la exportación, acumulación de Pi citosólico, acumulación de Pi estromático y abundancia de carbono estromático. Al modificar manualmente cualquier deslizador se activa la exploración libre.

El mapa separa los compartimentos citosólico y cloroplástico. Las etapas dirigidas se dibujan como metabolito → proceso → metabolito; en las interconversiones, la enzima aparece junto a las flechas antiparalelas. Las activaciones terminan en punta de flecha verde y las inhibiciones en barra perpendicular roja.

Las interconversiones mediante PGI, PGM, UGPasa y aldolasa se representan mediante dos flechas antiparalelas. Sus grosores independientes muestran la preferencia relativa de cada sentido. El ciclo F6P/F2,6BP también utiliza dos flechas porque la síntesis y la hidrólisis dependen de enzimas diferentes. Las etapas SPS, SPP, FBPasa, AGPasa y formación de almidón permanecen dirigidas.

Las regulaciones de largo alcance se conducen por corredores exteriores al mapa metabólico para evitar atravesar metabolitos o enzimas. Las líneas cortas de catálisis local permanecen junto a la reacción correspondiente.

## Alcance científico

El modelo utiliza unidades relativas. F2,6BP se calcula mediante un balance simplificado entre F6P-2-quinasa y F2,6BPasa, considerando F6P, Pi y triosas-P. El aumento de triosas-P citosólicas no reduce directamente F2,6BP. La aplicación es un recurso didáctico, no un modelo cinético calibrado experimentalmente.
