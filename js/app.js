// Configuración API Key de Google Drive.
const GOOGLE_API_KEY = '';
const GOOGLE_CLIENT_ID = '';
const GOOGLE_APP_ID = ''; // El número del proyecto, no el string largo

document.addEventListener("DOMContentLoaded", () => {
    // Referencias DOM

  // constantes de los diferentes elementos.
    const navButtons = document.querySelectorAll(".nav-btn");
    const toolSections = document.querySelectorAll(".tool-section");
    const fileInput = document.getElementById("fileInput");
    const fileInfo = document.getElementById("fileInfo");
    const urlBtn = document.getElementById("btnUrl");
    const urlInputWrapper = document.getElementById("urlInputWrapper");
    const urlInput = document.getElementById("urlInput");
    const btnLoadUrl = document.getElementById("btnLoadUrl");
    const btnDrive = document.getElementById("btnDrive");
    const btnDropbox = document.getElementById("btnDropbox");

    const pdfCanvas = document.getElementById("pdfCanvas");
    const pageInfo = document.getElementById("pageInfo");
    const btnPrevPage = document.getElementById("btnPrevPage");
    const btnNextPage = document.getElementById("btnNextPage");

    const resultMessage = document.getElementById("resultMessage");
    const downloadLink = document.getElementById("downloadLink");

    // Herramientas
    const splitRanges = document.getElementById("splitRanges");
    const btnSplit = document.getElementById("btnSplit");

    const mergeFilesInput = document.getElementById("mergeFilesInput");
    const mergeFileList = document.getElementById("mergeFileList");
    const btnAddMergeFiles = document.getElementById("btnAddMergeFiles");
    const btnMerge = document.getElementById("btnMerge");

    const compressLevel = document.getElementById("compressLevel");
    const btnCompress = document.getElementById("btnCompress");

    const convertFormat = document.getElementById("convertFormat");
    const btnConvert = document.getElementById("btnConvert");

    const protectRadios = document.querySelectorAll('input[name="protectMode"]');
    const addPasswordFields = document.getElementById("addPasswordFields");
    const removePasswordFields = document.getElementById("removePasswordFields");
    const passwordNew = document.getElementById("passwordNew");
    const passwordConfirm = document.getElementById("passwordConfirm");
    const passwordCurrent = document.getElementById("passwordCurrent");
    const btnProtect = document.getElementById("btnProtect");

    // Estado local
    let currentPage = 1;
    let totalPages = 0;

    // Lista de archivos para combinar
    let mergeFilesArray = [];

    // --- Funciones UI ---

    function updateFileInfo(text) {
        fileInfo.textContent = text;
    }

    function setResult(message, blob, suggestedName) {
        resultMessage.textContent = message;
        if (blob) {
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.download = suggestedName || "resultado.pdf";
            downloadLink.classList.remove("hidden");
            downloadLink.textContent = "Descargar Archivo";
        } else {
            downloadLink.classList.add("hidden");
        }
    }

    function resetPreview() {
        const ctx = pdfCanvas.getContext("2d");
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, pdfCanvas.width || 300, pdfCanvas.height || 150);
        pageInfo.textContent = "Vista previa no disponible";
        currentPage = 1;
        totalPages = 0;
    }

    // --- Navegación ---
    navButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tool = btn.dataset.tool;
            navButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            toolSections.forEach((section) => {
                section.classList.add("hidden");
            });
            const activeSection = document.getElementById(`tool-${tool}`);
            if (activeSection) activeSection.classList.remove("hidden");

            // Limpiar resultado al cambiar pestaña
            setResult("Esperando acción...", null);
        });
    });

    // --- Carga de Archivos Local ---
    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        handleFileSelection(file);
    });

    async function handleFileSelection(file) {
        if (file.type !== "application/pdf") {
            updateFileInfo("El archivo debe ser un PDF.");
            return;
        }
        try {
            updateFileInfo(`Cargando: ${file.name}...`);
            await PdfTools.setCurrentFile(file);
            updateFileInfo(`Listo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            resetPreview(); // Aquí se podría implementar preview real con pdf.js
            setResult("Archivo cargado. Elige una opción.", null);
        } catch (error) {
            console.error(error);
            updateFileInfo("Error al leer el archivo PDF.");
        }
    }

    // --- Carga URL ---
    urlBtn.addEventListener("click", () => urlInputWrapper.classList.toggle("visible"));
    btnLoadUrl.addEventListener("click", async () => {
        const url = urlInput.value.trim();
        if (!url) return;
        updateFileInfo("Descargando desde URL...");
        try {
            // Nota: Esto fallará si el servidor destino no tiene CORS habilitado
            const res = await fetch(url);
            if (!res.ok) throw new Error("Error de red");
            const blob = await res.blob();
            const file = new File([blob], "url-import.pdf", { type: "application/pdf" });
            handleFileSelection(file);
        } catch (e) {
            updateFileInfo("Error: No se puede acceder a la URL (posible bloqueo CORS).");
        }
    });

    // --- 1. DIVIDIR ---
    btnSplit.addEventListener("click", async () => {
        const ranges = splitRanges.value.trim();
        if (!ranges) return alert("Introduce rangos (ej: 1-2, 5).");
        try {
            setResult("Procesando...", null);
            const blob = await PdfTools.splitPdf(ranges);
            setResult("PDF Dividido con éxito.", blob, "dividido.pdf");
        } catch (err) {
            alert(err.message);
            setResult("Error en la operación.", null);
        }
    });

    // --- 2. COMBINAR (Con función borrar) ---
    btnAddMergeFiles.addEventListener("click", () => mergeFilesInput.click());

    mergeFilesInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files).filter(f => f.type === "application/pdf");
        mergeFilesArray = mergeFilesArray.concat(files);
        renderMergeList();
        // Limpiar input para permitir seleccionar el mismo archivo
        mergeFilesInput.value = "";
    });

    function renderMergeList() {
        mergeFileList.innerHTML = "";
        if (mergeFilesArray.length === 0) {
            mergeFileList.innerHTML = "<li>No hay archivos seleccionados.</li>";
            return;
        }

        mergeFilesArray.forEach((file, index) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span>${index + 1}. ${file.name}</span>
                <button class="btn-delete" data-index="${index}" style="margin-left:10px; color:red; cursor:pointer;">X</button>
            `;
            mergeFileList.appendChild(li);
        });

        // Event listeners para los botones borrar
        document.querySelectorAll(".btn-delete").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.target.dataset.index);
                mergeFilesArray.splice(idx, 1);
                renderMergeList();
            });
        });
    }

    btnMerge.addEventListener("click", async () => {
        if (mergeFilesArray.length < 2) return alert("Sube al menos 2 PDFs.");
        try {
            setResult("Combinando...", null);
            const blob = await PdfTools.mergePdfs(mergeFilesArray);
            setResult("PDFs combinados correctamente.", blob, "combinado.pdf");
        } catch (err) {
            console.error(err);
            setResult("Error al combinar.", null);
        }
    });

    // --- 3. COMPRIMIR ---
    btnCompress.addEventListener("click", async () => {
        try {
            setResult("Comprimiendo...", null);
            const blob = await PdfTools.compressPdf(compressLevel.value);
            setResult("Compresión finalizada.", blob, "comprimido.pdf");
        } catch (err) {
            console.error(err);
            alert(err.message);
            setResult("Error al comprimir.", null);
        }
    });

    // --- 4. CONVERTIR ---
    btnConvert.addEventListener("click", async () => {
        try {
            setResult("Convirtiendo (esto puede tardar)...", null);
            const result = await PdfTools.convertPdf(convertFormat.value);
            setResult("Conversión lista.", result.blob, `convertido.${result.ext}`);
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
            setResult("Error en conversión.", null);
        }
    });

    // --- 5. PROTEGER / DESPROTEGER ---
    protectRadios.forEach(r => r.addEventListener("change", toggleProtectMode));

    function toggleProtectMode() {
        const mode = document.querySelector('input[name="protectMode"]:checked').value;
        if (mode === "add") {
            addPasswordFields.classList.remove("hidden");
            removePasswordFields.classList.add("hidden");
        } else {
            addPasswordFields.classList.add("hidden");
            removePasswordFields.classList.remove("hidden");
        }
    }

    btnProtect.addEventListener("click", async () => {
        const mode = document.querySelector('input[name="protectMode"]:checked').value;
        const passwords = {
            newPassword: passwordNew.value,
            currentPassword: passwordCurrent.value
        };

        if (mode === "add" && (!passwords.newPassword || passwords.newPassword !== passwordConfirm.value)) {
            return alert("Las contraseñas no coinciden o están vacías.");
        }
        if (mode === "remove" && !passwords.currentPassword) {
            return alert("Introduce la contraseña actual del PDF.");
        }

        try {
            setResult("Procesando seguridad...", null);
            const blob = await PdfTools.protectPdf(mode, passwords);
            setResult("Operación completada.", blob, mode === "add" ? "protegido.pdf" : "desprotegido.pdf");
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
            setResult("Error de seguridad.", null);
        }
    });


    // --- GOOGLE DRIVE & DROPBOX INTEGRATION ---
    // Variables globales para OAuth
    let tokenClient;
    let accessToken = null;
    let gapiInited = false;
    let gisInited = false;

    // Cargar librerías Google
    function loadGoogleLibs() {
        const scriptGapi = document.createElement('script');
        scriptGapi.src = "https://apis.google.com/js/api.js";
        scriptGapi.onload = () => {
            gapi.load('client:picker', async () => {
                await gapi.client.load('drive', 'v3');
                gapiInited = true;
            });
        };
        document.head.appendChild(scriptGapi);

        const scriptGis = document.createElement('script');
        scriptGis.src = "https://accounts.google.com/gsi/client";
        scriptGis.onload = () => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.readonly',
                callback: (tokenResponse) => {
                    accessToken = tokenResponse.access_token;
                    if (accessToken) showGooglePicker();
                },
            });
            gisInited = true;
        };
        document.head.appendChild(scriptGis);
    }

    // Iniciar carga al abrir
    loadGoogleLibs();

    // Evento Botón Drive
    btnDrive.addEventListener("click", () => {
        if (!gapiInited || !gisInited) return alert("Conectando con Google... intenta en unos segundos.");
        tokenClient.requestAccessToken({ prompt: '' });
    });

    function showGooglePicker() {
        const view = new google.picker.View(google.picker.ViewId.DOCS);
        view.setMimeTypes("application/pdf");
        const picker = new google.picker.PickerBuilder()
            .setDeveloperKey(GOOGLE_API_KEY)
            .setAppId(GOOGLE_APP_ID)
            .setOAuthToken(accessToken)
            .addView(view)
            .setCallback(async (data) => {
                if (data.action === google.picker.Action.PICKED) {
                    const fileId = data.docs[0].id;
                    const name = data.docs[0].name;
                    updateFileInfo(`Descargando ${name} de Drive...`);
                    try {
                        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                        const blob = await res.blob();
                        handleFileSelection(new File([blob], name, { type: "application/pdf" }));
                    } catch (e) {
                        alert("Error descargando de Drive.");
                    }
                }
            })
            .build();
        picker.setVisible(true);
    }

    // Evento Botón Dropbox
    btnDropbox.addEventListener("click", () => {
        if (window.Dropbox) {
            openDropbox();
        } else {
            const script = document.createElement('script');
            script.src = 'https://www.dropbox.com/static/api/2/dropins.js';
            script.id = 'dropboxjs';
            script.dataset.appKey = DROPBOX_APP_KEY;
            script.onload = openDropbox;
            document.head.appendChild(script);
        }
    });

    function openDropbox() {
        Dropbox.choose({
            success: async (files) => {
                const f = files[0];
                updateFileInfo(`Descargando ${f.name} de Dropbox...`);
                try {
                    const res = await fetch(f.link);
                    const blob = await res.blob();
                    handleFileSelection(new File([blob], f.name, { type: "application/pdf" }));
                } catch (e) {
                    alert("Error descargando de Dropbox.");
                }
            },
            linkType: "direct",
            multiselect: false,
            extensions: ['.pdf']
        });
    }

    // Inicializar UI
    resetPreview();
    renderMergeList();
});
