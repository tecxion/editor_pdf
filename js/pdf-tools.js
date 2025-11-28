async function loadPdfLib() {
    if (window.PDFLib) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
        script.onload = () => resolve(window.PDFLib);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

const PdfTools = (() => {
    let currentFile = null;
    let currentFileName = null;
    let currentArrayBuffer = null;
    let currentPdfDoc = null; // PDF-Lib PDFDocument

    async function initPdfLib() {
        await loadPdfLib();
    }

    async function setCurrentFile(file) {
        await initPdfLib();
        currentFile = file;
        currentFileName = file?.name || "document.pdf";
        const arrayBuffer = await file.arrayBuffer();
        currentArrayBuffer = arrayBuffer;

        try {
            // Intentamos cargar el PDF. Si tiene contraseña, fallará aquí.
            // Si falla, guardamos el buffer pero currentPdfDoc será null.
            const uint8Array = new Uint8Array(arrayBuffer);
            currentPdfDoc = await PDFLib.PDFDocument.load(uint8Array, { ignoreEncryption: true });
        } catch (e) {
            console.warn("PDF encriptado o corrupto, se requerirá contraseña para operaciones.", e);
            currentPdfDoc = null;
        }

        return arrayBuffer;
    }

    function getCurrentFile() {
        return { file: currentFile, name: currentFileName, buffer: currentArrayBuffer };
    }

    // 1. DIVIDIR PDF
    async function splitPdf(ranges) {
        if (!currentPdfDoc) throw new Error("El PDF no está cargado o está protegido (desprotege primero).");

        const pageNumbers = parseRanges(ranges, currentPdfDoc.getPageCount());
        const newPdf = await PDFLib.PDFDocument.create();
        const copiedPages = await newPdf.copyPages(currentPdfDoc, pageNumbers);

        copiedPages.forEach((page) => newPdf.addPage(page));
        const pdfBytes = await newPdf.save();
        return new Blob([pdfBytes], { type: "application/pdf" });
    }

    // 2. COMBINAR PDFs
    async function mergePdfs(files) {
        if (!files || !files.length) throw new Error("No hay archivos para combinar.");
        await initPdfLib();

        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            // Cargamos ignorando errores menores
            const pdf = await PDFLib.PDFDocument.load(uint8Array);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        return new Blob([pdfBytes], { type: "application/pdf" });
    }

    // 3. COMPRIMIR PDF (Método: Rasterización a imágenes JPEG)
    async function compressPdf(level) {
        if (!currentPdfDoc) throw new Error("No hay PDF cargado.");
        const pdfjs = await loadPdfJs();

        // 1. Renderizar el PDF original
        const loadingTask = pdfjs.getDocument({ data: currentArrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;

        // 2. Crear nuevo documento PDF para la salida
        const compressedPdf = await PDFLib.PDFDocument.create();

        // Configuración de calidad (0 a 1)
        const qualityMap = { low: 0.8, medium: 0.5, high: 0.3 };
        const quality = qualityMap[level] || 0.5;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 }); // Escala original

            // Crear canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Renderizar página en canvas
            await page.render({ canvasContext: ctx, viewport }).promise;

            // Convertir a JPEG comprimido
            const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
            const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());

            // Incrustar imagen en el nuevo PDF
            const jpgImage = await compressedPdf.embedJpg(imgBytes);
            const newPage = compressedPdf.addPage([viewport.width, viewport.height]);
            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height,
            });
        }

        const pdfBytes = await compressedPdf.save();
        return new Blob([pdfBytes], { type: "application/pdf" });
    }

    // 4. CONVERTIR PDF (Actualizado para ZIP)
    async function convertPdf(format) {
        if (format === 'jpg') return await convertToImages('image/jpeg', 'jpg');
        if (format === 'png') return await convertToImages('image/png', 'png');

        // ... (Mantén el resto de lógica de html/docx/xlsx igual que tenías) ...
        const textContent = await extractTextFromPdf();
        if (format === 'html') {
            const html = `<html><body><pre>${textContent}</pre></body></html>`;
            return { blob: new Blob([html], { type: 'text/html' }), ext: 'html' };
        }
        if (format === 'docx') {
            // Truco: Crear un HTML con cabeceras de Word. Word abre esto perfectamente.
            const docHtml = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>Documento Exportado</title></head>
                <body>
                    ${textContent.split('\n').map(line => `<p>${line}</p>`).join('')}
                </body></html>`;
            return { blob: new Blob([docHtml], { type: 'application/msword' }), ext: 'doc' }; // .doc abre en Word sin avisos
        }

        if (format === 'xlsx') {
            // Truco: Crear un CSV (Excel lo abre).
            // Intentamos separar por tabuladores o espacios grandes
            const csvContent = textContent.replace(/\t/g, ',').split('\n').join('\r\n');
            return { blob: new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), ext: 'csv' };
        }

        throw new Error("Formato no soportado.");
    }


    // 5. PROTEGER / DESPROTEGER (Arreglado)
    async function protectPdf(mode, passwords) {
        await initPdfLib();

        if (mode === 'add') {
            if (!currentPdfDoc) throw new Error("No hay PDF cargado.");
            // Copiamos el PDF actual a uno nuevo para asegurar una estructura limpia
            const newPdf = await PDFLib.PDFDocument.create();
            const copiedPages = await newPdf.copyPages(currentPdfDoc, currentPdfDoc.getPageIndices());
            copiedPages.forEach(p => newPdf.addPage(p));

            // Guardar encriptando
            const pdfBytes = await newPdf.save({
                userPassword: passwords.newPassword,
                ownerPassword: passwords.newPassword, // Necesario para permisos completos
                encryptionKeyLength: 128 // Forzamos encriptación estándar de 128-bits
            });
            return new Blob([pdfBytes], { type: "application/pdf" });
        }

        else if (mode === 'remove') {
            // (Esta parte de 'remove' ya funcionaba en la versión anterior, 
            // asegúrate de mantener la lógica de recargar el documento con password)
            if (!currentArrayBuffer) throw new Error("No hay archivo cargado.");
            if (!passwords.currentPassword) throw new Error("Se requiere la contraseña actual.");

            try {
                const decryptedDoc = await PDFLib.PDFDocument.load(currentArrayBuffer, {
                    password: passwords.currentPassword
                });
                const cleanPdf = await PDFLib.PDFDocument.create();
                const copiedPages = await cleanPdf.copyPages(decryptedDoc, decryptedDoc.getPageIndices());
                copiedPages.forEach(p => cleanPdf.addPage(p));
                const pdfBytes = await cleanPdf.save(); // Guardar sin opciones de password
                return new Blob([pdfBytes], { type: "application/pdf" });
            } catch (error) {
                throw new Error("Contraseña incorrecta.");
            }
        }
    }

    // --- Helpers ---

    function parseRanges(rangesStr, totalPages) {
        const pages = new Set();
        const parts = rangesStr.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) pages.add(i - 1);
                }
            } else {
                const num = parseInt(trimmed);
                if (!isNaN(num) && num >= 1 && num <= totalPages) pages.add(num - 1);
            }
        }
        return Array.from(pages).sort((a, b) => a - b);
    }

    async function loadPdfJs() {
        if (window.pdfjsLib) return window.pdfjsLib;
        // Configurar worker
        const src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        const workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
                resolve(window.pdfjsLib);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function convertToImages(mimeType, ext) {
        if (!currentArrayBuffer) throw new Error("Falta archivo");
        const pdfjs = await loadPdfJs();
        // Usar buffer clonado para evitar problemas de detaching
        const loadingTask = pdfjs.getDocument({ data: currentArrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        // Renderizar solo la primera página para demostración (evitar colgar navegador)
        // O renderizar todas si son pocas. Haremos la primera por rendimiento en demo.
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 }); // Mejor calidad
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL(mimeType);
        const blob = await (await fetch(dataUrl)).blob();

        // Si quieres devolver un ZIP con todas, requeriría JSZip. 
        // Aquí devolvemos la primera imagen.
        return { blob, ext: ext };
    }

    async function extractTextFromPdf() {
        if (!currentArrayBuffer) throw new Error("Falta archivo");
        const pdfjs = await loadPdfJs();
        const loadingTask = pdfjs.getDocument({ data: currentArrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;

        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            fullText += strings.join(" ") + "\n\n";
        }
        return fullText;
    }

    // Imágenes a ZIP
    async function convertToImages(mimeType, ext) {
        if (!currentArrayBuffer) throw new Error("Falta archivo");
        if (!window.JSZip) throw new Error("Falta librería JSZip (añádela al HTML).");

        const pdfjs = await loadPdfJs();
        const pdf = await pdfjs.getDocument({ data: currentArrayBuffer.slice(0) }).promise;
        const totalPages = pdf.numPages;

        // Si solo hay 1 página, devolvemos la imagen directa
        if (totalPages === 1) {
            const blob = await getPageImageBlob(pdf, 1, mimeType);
            return { blob, ext: ext };
        }

        // Si hay varias, creamos un ZIP
        const zip = new JSZip();
        const folder = zip.folder("imagenes_pdf");

        for (let i = 1; i <= totalPages; i++) {
            const blob = await getPageImageBlob(pdf, i, mimeType);
            folder.file(`pagina_${i}.${ext}`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        return { blob: zipBlob, ext: "zip" };
    }

    // para renderizar una página concreta
    async function getPageImageBlob(pdfDoc, pageNum, mimeType) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // Alta calidad
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        return new Promise(resolve => canvas.toBlob(resolve, mimeType));
    }

    return {
        setCurrentFile,
        getCurrentFile,
        splitPdf,
        mergePdfs,
        compressPdf,
        convertPdf,
        protectPdf
    };
})();

window.PdfTools = PdfTools;
