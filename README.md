# PDF Tools Web App

Aplicación web en JavaScript para trabajar con archivos PDF directamente en el navegador. Permite dividir, combinar, comprimir, convertir y proteger/desproteger PDFs sin enviar los documentos a un servidor.

## Características

- Subida de PDF desde:
  - Disco local.
  - URL pública (limitado por CORS).
- Herramientas incluidas:
  - Dividir PDF por rangos de páginas (ej: `1-3,5,7-9`).
  - Combinar varios PDFs en un solo archivo (con lista de archivos y opción de eliminar).
  - Comprimir PDF convirtiendo las páginas a imágenes JPEG con distintos niveles de calidad.
  - Convertir PDF a:
    - Imágenes JPG/PNG (una o varias páginas, con ZIP cuando hay varias).
    - HTML sencillo.
    - DOC (HTML compatible con Word).
    - CSV (a partir del texto extraído).
  - Quitar protección de PDFs protegidos con contraseña (requiere conocer la contraseña actual).

Toda la lógica se ejecuta en el navegador usando librerías JavaScript, por lo que los documentos no se suben a ningún servidor.

## Tecnologías utilizadas

- HTML5 y CSS3 para la interfaz.
- JavaScript puro para la lógica de la aplicación.
- [PDF-Lib](https://github.com/Hopding/pdf-lib) para manipulación de PDFs (dividir, combinar, proteger, desproteger).
- [PDF.js](https://github.com/mozilla/pdf.js) para renderizar y extraer texto de PDFs.
- [JSZip](https://stuk.github.io/jszip/) para generar archivos ZIP con imágenes.

## Estructura del proyecto

- `index.html`: Estructura principal de la interfaz web y secciones de cada herramienta.
- `styles.css`: Estilos de la aplicación con diseño oscuro, layout responsive y componentes de la UI.
- `app.js`: Lógica de la interfaz, manejo de eventos, carga de archivos, conexión entre la UI y las funciones de PDF.
- `pdf-tools.js`: Módulo con las funciones de manipulación de PDF (dividir, combinar, comprimir, convertir, proteger/desproteger).

## Cómo usar

1. Clona el repositorio o descarga los archivos.

```
git clone https://github.com/tecxion/editor_pdf.git
cd editor_pdf
```

2. Abre `index.html` en tu navegador (doble clic o con un servidor estático tipo `Live Server`).

3. Carga un PDF:
   - Desde tu ordenador.
   - Desde una URL (si el servidor permite CORS).

4. Elige la herramienta en el menú superior:
   - Dividir, Combinar, Comprimir, Convertir o Proteger.

5. Configura las opciones de cada herramienta y pulsa el botón correspondiente.

6. Descarga el resultado usando el botón "Descargar archivo".

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox, etc.).
- Conexión a Internet para cargar las librerías desde CDN:
  - PDF-Lib.
  - PDF.js.
  - JSZip.

Si prefieres, puedes modificar `index.html` para servir las librerías de forma local en lugar de usar los CDNs.

## Notas

- La carga por URL depende de que el servidor del PDF permita peticiones CORS.
- La compresión por imágenes puede aumentar el tamaño del archivo si el PDF original ya está muy optimizado o si las páginas tienen mucho contenido.
- La conversión a DOC/CSV se basa en texto plano extraído; el formato del documento puede no ser idéntico al PDF original.

## Licencia

Este proyecto tiene una licencia MIT y es de uso público, solo tendrás que hacer mención a este repositorio.

>![NOTE]
>Hay una función para añadir contraseñas pero no está correctamente implementada y no funciona el añadir o quitar contraseñas.

<h1 align="center">
   <a href="https://paypal.me/jfmpkiko">
<img src="https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white" alt="Paypal" />  </a><a href="https://coff.ee/tecxart"><img src="https://github.com/tecxion/TecXion/blob/main/Media/cafe1.png" alt="Cafe">   <img alt="GitHub watchers" src="https://img.shields.io/github/watchers/tecxion/tecxion">    <img alt="GitHub User's stars" src="https://img.shields.io/github/stars/tecxion">

</a>
</h1>

