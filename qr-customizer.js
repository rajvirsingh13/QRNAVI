"use strict";

/*
 * QRNAVI — QR Customizer
 * ------------------------------------------------------------
 * Responsibilities:
 * 1. Read the QR payload saved by download-system.js.
 * 2. Load QRCode.js when required.
 * 3. Generate the QR automatically.
 * 4. Apply templates instantly.
 * 5. Apply QR color instantly.
 * 6. Apply background color instantly.
 * 7. Apply size instantly.
 * 8. Check QR contrast/readability.
 * 9. Reset customization instantly.
 * 10. Download the current customized QR as PNG.
 *
 * Important:
 * - There is NO Apply button.
 * - QR payload/data never changes.
 * - This page is intentionally desktop-only.
 * - No logo/pattern/frame feature is faked.
 */

(function () {
    const CONFIG = {
        qrLibraryUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",

        downloadSystemUrl: "download-system.js",

        storageKey: "qrnaviCustomizerState",

        defaultSettings: {
            foreground: "#071426",
            background: "#FFFFFF",
            size: 320,
            template: "classic"
        },

        minHexLength: 6
    };

    /*
     * ------------------------------------------------------------
     * DOM references
     * ------------------------------------------------------------
     */

    let qrOutput = null;
    let emptyState = null;
    let errorElement = null;
    let contrastStatus = null;

    let qrColorPicker = null;
    let qrColorHex = null;

    let backgroundColorPicker = null;
    let backgroundColorHex = null;

    let currentPayload = "";
    let currentType = "unknown";

    let currentSettings = {
        foreground: CONFIG.defaultSettings.foreground,
        background: CONFIG.defaultSettings.background,
        size: CONFIG.defaultSettings.size,
        template: CONFIG.defaultSettings.template
    };

    let qrLibraryPromise = null;
    let downloadSystemPromise = null;
    let renderTimer = null;
    let isRendering = false;


    /*
     * ------------------------------------------------------------
     * Initialization
     * ------------------------------------------------------------
     */

    function init() {
        cacheDOM();

        if (!qrOutput) {
            return;
        }

        bindEvents();
        loadCustomizerState();
    }


    function cacheDOM() {
        qrOutput =
            document.getElementById("customizer-qr-output");

        emptyState =
            document.getElementById("customizer-empty-state");

        errorElement =
            document.getElementById("customizer-error");

        contrastStatus =
            document.getElementById("contrast-status");

        qrColorPicker =
            document.getElementById("qr-color-picker");

        qrColorHex =
            document.getElementById("qr-color-hex");

        backgroundColorPicker =
            document.getElementById(
                "background-color-picker"
            );

        backgroundColorHex =
            document.getElementById(
                "background-color-hex"
            );
    }


    /*
     * ------------------------------------------------------------
     * Event binding
     * ------------------------------------------------------------
     */

    function bindEvents() {
        bindTemplateEvents();
        bindQRColorEvents();
        bindBackgroundColorEvents();
        bindSizeEvents();

        const resetButton =
            document.getElementById(
                "reset-customization"
            );

        if (resetButton) {
            resetButton.addEventListener(
                "click",
                resetCustomization
            );
        }

        const downloadButton =
            document.getElementById(
                "customizer-download"
            );

        if (downloadButton) {
            downloadButton.addEventListener(
                "click",
                downloadCustomizedQR
            );
        }
    }


    /*
     * ------------------------------------------------------------
     * Load saved QR state
     * ------------------------------------------------------------
     */

    function loadCustomizerState() {
        let state = null;

        /*
         * Prefer the API exposed by download-system.js
         * when it is available.
         */
        if (
            window.QRNAVI_DOWNLOAD &&
            typeof window.QRNAVI_DOWNLOAD
                .getCustomizerState === "function"
        ) {
            state =
                window.QRNAVI_DOWNLOAD
                    .getCustomizerState();
        }

        /*
         * Direct sessionStorage fallback.
         * This keeps the customizer working even if the shared
         * download script has not finished loading yet.
         */
        if (!state) {
            state = readStoredState();
        }

        if (
            !state ||
            typeof state.payload !== "string" ||
            state.payload.trim() === ""
        ) {
            showEmptyState();
            return;
        }

        currentPayload = state.payload;
        currentType =
            typeof state.type === "string" &&
            state.type.trim() !== ""
                ? state.type
                : "unknown";

        hideEmptyState();
        syncControlsWithSettings();
        updateContrast();

        renderQR();
    }


    function readStoredState() {
        try {
            const stored =
                sessionStorage.getItem(
                    CONFIG.storageKey
                );

            if (!stored) {
                return null;
            }

            const parsed = JSON.parse(stored);

            if (
                !parsed ||
                typeof parsed !== "object"
            ) {
                return null;
            }

            if (
                typeof parsed.payload !== "string" ||
                parsed.payload.trim() === ""
            ) {
                return null;
            }

            return parsed;
        } catch (error) {
            console.warn(
                "QRNAVI: Unable to read saved QR state.",
                error
            );

            return null;
        }
    }


    /*
     * ------------------------------------------------------------
     * Empty state
     * ------------------------------------------------------------
     */

    function showEmptyState() {
        if (emptyState) {
            emptyState.hidden = false;
        }

        if (qrOutput) {
            qrOutput.hidden = true;
            qrOutput.innerHTML = "";
        }

        disableCustomizerControls();
    }


    function hideEmptyState() {
        if (emptyState) {
            emptyState.hidden = true;
        }

        if (qrOutput) {
            qrOutput.hidden = false;
        }

        enableCustomizerControls();
    }


    function disableCustomizerControls() {
        const controls =
            document.querySelectorAll(
                ".customizer-controls button, " +
                ".customizer-controls input"
            );

        controls.forEach(function (control) {
            if (
                control.id !== "reset-customization"
            ) {
                control.disabled = true;
            }
        });
    }


    function enableCustomizerControls() {
        const controls =
            document.querySelectorAll(
                ".customizer-controls button, " +
                ".customizer-controls input"
            );

        controls.forEach(function (control) {
            control.disabled = false;
        });
    }


    /*
     * ------------------------------------------------------------
     * Template events
     * ------------------------------------------------------------
     */

    function bindTemplateEvents() {
        const templates =
            document.querySelectorAll(
                ".template-card[data-template]"
            );

        templates.forEach(function (button) {
            button.addEventListener(
                "click",
                function () {
                    const template =
                        button.getAttribute(
                            "data-template"
                        );

                    if (!template) {
                        return;
                    }

                    applyTemplate(template);
                }
            );
        });
    }


    function applyTemplate(template) {
        const templates = {
            classic: {
                foreground: "#071426",
                background: "#FFFFFF"
            },

            business: {
                foreground: "#111827",
                background: "#FFFFFF"
            },

            social: {
                foreground: "#7C3AED",
                background: "#FFFFFF"
            },

            modern: {
                foreground: "#2589F4",
                background: "#F7F9FC"
            },

            minimal: {
                foreground: "#344054",
                background: "#FFFFFF"
            },

            colorful: {
                foreground: "#BE123C",
                background: "#FFF7ED"
            },

            professional: {
                foreground: "#1478DF",
                background: "#F0F7FF"
            }
        };

        const selected =
            templates[template];

        if (!selected) {
            return;
        }

        currentSettings.template = template;
        currentSettings.foreground =
            selected.foreground;
        currentSettings.background =
            selected.background;

        updateTemplateButtons();
        syncColorControls();
        updateContrast();
        scheduleRender();
    }


    function updateTemplateButtons() {
        const buttons =
            document.querySelectorAll(
                ".template-card[data-template]"
            );

        buttons.forEach(function (button) {
            const isActive =
                button.getAttribute(
                    "data-template"
                ) === currentSettings.template;

            button.classList.toggle(
                "is-active",
                isActive
            );

            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        });
    }


    /*
     * ------------------------------------------------------------
     * QR Color events
     * ------------------------------------------------------------
     */

    function bindQRColorEvents() {
        if (qrColorPicker) {
            qrColorPicker.addEventListener(
                "input",
                function () {
                    const color =
                        normalizeColor(
                            qrColorPicker.value
                        );

                    if (!color) {
                        return;
                    }

                    currentSettings.foreground =
                        color;

                    currentSettings.template =
                        "custom";

                    syncQRColorHex();
                    updateTemplateButtons();
                    updateContrast();
                    scheduleRender();
                }
            );
        }

        if (qrColorHex) {
            qrColorHex.addEventListener(
                "input",
                function () {
                    handleHexInput(
                        qrColorHex,
                        "foreground"
                    );
                }
            );

            qrColorHex.addEventListener(
                "blur",
                function () {
                    finalizeHexInput(
                        qrColorHex,
                        "foreground"
                    );
                }
            );
        }

        bindPresetButtons(
            "qr-color-presets",
            "foreground"
        );
    }


    /*
     * ------------------------------------------------------------
     * Background color events
     * ------------------------------------------------------------
     */

    function bindBackgroundColorEvents() {
        if (backgroundColorPicker) {
            backgroundColorPicker.addEventListener(
                "input",
                function () {
                    const color =
                        normalizeColor(
                            backgroundColorPicker.value
                        );

                    if (!color) {
                        return;
                    }

                    currentSettings.background =
                        color;

                    currentSettings.template =
                        "custom";

                    syncBackgroundHex();
                    updateTemplateButtons();
                    updateContrast();
                    scheduleRender();
                }
            );
        }

        if (backgroundColorHex) {
            backgroundColorHex.addEventListener(
                "input",
                function () {
                    handleHexInput(
                        backgroundColorHex,
                        "background"
                    );
                }
            );

            backgroundColorHex.addEventListener(
                "blur",
                function () {
                    finalizeHexInput(
                        backgroundColorHex,
                        "background"
                    );
                }
            );
        }

        bindPresetButtons(
            "background-color-presets",
            "background"
        );
    }


    function bindPresetButtons(
        containerId,
        settingName
    ) {
        const container =
            document.getElementById(
                containerId
            );

        if (!container) {
            return;
        }

        const buttons =
            container.querySelectorAll(
                ".preset-color[data-color]"
            );

        buttons.forEach(function (button) {
            button.addEventListener(
                "click",
                function () {
                    const color =
                        normalizeColor(
                            button.getAttribute(
                                "data-color"
                            )
                        );

                    if (!color) {
                        return;
                    }

                    currentSettings[settingName] =
                        color;

                    currentSettings.template =
                        "custom";

                    if (
                        settingName ===
                        "foreground"
                    ) {
                        syncQRColorHex();
                    } else {
                        syncBackgroundHex();
                    }

                    updateTemplateButtons();
                    updateContrast();
                    scheduleRender();
                }
            );
        });
    }


    /*
     * ------------------------------------------------------------
     * HEX input handling
     * ------------------------------------------------------------
     */

    function handleHexInput(
        input,
        settingName
    ) {
        let value =
            input.value
                .replace(/^#/g, "")
                .replace(/[^a-fA-F0-9]/g, "")
                .slice(0, CONFIG.minHexLength);

        input.value = value.toUpperCase();

        if (
            value.length !==
            CONFIG.minHexLength
        ) {
            return;
        }

        const color =
            normalizeColor("#" + value);

        if (!color) {
            return;
        }

        currentSettings[settingName] =
            color;

        currentSettings.template =
            "custom";

        updateTemplateButtons();
        updateContrast();
        scheduleRender();
    }


    function finalizeHexInput(
        input,
        settingName
    ) {
        let value =
            input.value
                .replace(/^#/g, "")
                .replace(/[^a-fA-F0-9]/g, "")
                .toUpperCase();

        if (
            value.length !==
            CONFIG.minHexLength
        ) {
            syncColorControls();
            return;
        }

        const color =
            normalizeColor("#" + value);

        if (!color) {
            syncColorControls();
            return;
        }

        currentSettings[settingName] =
            color;

        input.value =
            color.substring(1);

        updateContrast();
        scheduleRender();
    }


    function normalizeColor(value) {
        if (
            typeof value !== "string"
        ) {
            return null;
        }

        const cleaned =
            value.trim();

        if (
            !/^#[0-9a-fA-F]{6}$/.test(
                cleaned
            )
        ) {
            return null;
        }

        return cleaned.toUpperCase();
    }


    /*
     * ------------------------------------------------------------
     * Size events
     * ------------------------------------------------------------
     */

    function bindSizeEvents() {
        const buttons =
            document.querySelectorAll(
                ".size-option[data-size]"
            );

        buttons.forEach(function (button) {
            button.addEventListener(
                "click",
                function () {
                    const size =
                        Number(
                            button.getAttribute(
                                "data-size"
                            )
                        );

                    if (
                        !Number.isFinite(size) ||
                        size <= 0
                    ) {
                        return;
                    }

                    currentSettings.size =
                        size;

                    updateSizeButtons();
                    scheduleRender();
                }
            );
        });
    }


    function updateSizeButtons() {
        const buttons =
            document.querySelectorAll(
                ".size-option[data-size]"
            );

        buttons.forEach(function (button) {
            const size =
                Number(
                    button.getAttribute(
                        "data-size"
                    )
                );

            const isActive =
                size ===
                currentSettings.size;

            button.classList.toggle(
                "is-active",
                isActive
            );

            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        });
    }


    /*
     * ------------------------------------------------------------
     * Control synchronization
     * ------------------------------------------------------------
     */

    function syncControlsWithSettings() {
        updateTemplateButtons();
        updateSizeButtons();
        syncColorControls();
    }


    function syncColorControls() {
        syncQRColorPicker();
        syncQRColorHex();
        syncBackgroundPicker();
        syncBackgroundHex();
    }


    function syncQRColorPicker() {
        if (qrColorPicker) {
            qrColorPicker.value =
                currentSettings.foreground;
        }
    }


    function syncQRColorHex() {
        if (qrColorHex) {
            qrColorHex.value =
                currentSettings.foreground
                    .substring(1);
        }
    }


    function syncBackgroundPicker() {
        if (backgroundColorPicker) {
            backgroundColorPicker.value =
                currentSettings.background;
        }
    }


    function syncBackgroundHex() {
        if (backgroundColorHex) {
            backgroundColorHex.value =
                currentSettings.background
                    .substring(1);
        }
    }


    /*
     * ------------------------------------------------------------
     * Live rendering
     * ------------------------------------------------------------
     */

    function scheduleRender() {
        if (!currentPayload) {
            return;
        }

        if (renderTimer) {
            window.clearTimeout(
                renderTimer
            );
        }

        renderTimer =
            window.setTimeout(
                function () {
                    renderTimer = null;
                    renderQR();
                },
                60
            );
    }


    async function renderQR() {
        if (
            !qrOutput ||
            !currentPayload
        ) {
            return;
        }

        if (isRendering) {
            return;
        }

        isRendering = true;

        clearError();

        try {
            await loadQRCodeLibrary();

            if (
                typeof window.QRCode !==
                "function"
            ) {
                throw new Error(
                    "QRCode library unavailable."
                );
            }

            /*
             * qrcodejs does not update an existing QR
             * reliably, so we recreate only the preview.
             *
             * The payload remains exactly the same.
             */
            qrOutput.innerHTML = "";

            new window.QRCode(
                qrOutput,
                {
                    text: currentPayload,

                    width:
                        currentSettings.size,

                    height:
                        currentSettings.size,

                    colorDark:
                        currentSettings.foreground,

                    colorLight:
                        currentSettings.background,

                    correctLevel:
                        window.QRCode.CorrectLevel.M
                }
            );

            /*
             * Make sure the preview has a clear accessible
             * description without inserting the payload
             * into HTML.
             */
            qrOutput.setAttribute(
                "aria-label",
                "Live customized QR code preview"
            );

            updateContrast();

        } catch (error) {
            console.error(
                "QRNAVI: QR rendering failed.",
                error
            );

            showError(
                "The QR preview could not be updated. Please try again."
            );

        } finally {
            isRendering = false;
        }
    }


    /*
     * ------------------------------------------------------------
     * QRCode.js loader
     * ------------------------------------------------------------
     */

    function loadQRCodeLibrary() {
        if (
            typeof window.QRCode ===
            "function"
        ) {
            return Promise.resolve(
                window.QRCode
            );
        }

        if (qrLibraryPromise) {
            return qrLibraryPromise;
        }

        qrLibraryPromise =
            new Promise(
                function (resolve, reject) {
                    const existingScript =
                        document.querySelector(
                            'script[src="' +
                            CONFIG.qrLibraryUrl +
                            '"]'
                        );

                    if (existingScript) {
                        existingScript.addEventListener(
                            "load",
                            function () {
                                if (
                                    typeof window.QRCode ===
                                    "function"
                                ) {
                                    resolve(
                                        window.QRCode
                                    );
                                } else {
                                    reject(
                                        new Error(
                                            "QRCode library loaded without QRCode."
                                        )
                                    );
                                }
                            },
                            { once: true }
                        );

                        existingScript.addEventListener(
                            "error",
                            function () {
                                reject(
                                    new Error(
                                        "Unable to load QRCode library."
                                    )
                                );
                            },
                            { once: true }
                        );

                        return;
                    }

                    const script =
                        document.createElement(
                            "script"
                        );

                    script.src =
                        CONFIG.qrLibraryUrl;

                    script.async = true;

                    script.onload =
                        function () {
                            if (
                                typeof window.QRCode ===
                                "function"
                            ) {
                                resolve(
                                    window.QRCode
                                );
                            } else {
                                reject(
                                    new Error(
                                        "QRCode library loaded without QRCode."
                                    )
                                );
                            }
                        };

                    script.onerror =
                        function () {
                            reject(
                                new Error(
                                    "Unable to load QRCode library."
                                )
                            );
                        };

                    document.head.appendChild(
                        script
                    );
                }
            ).catch(function (error) {
                qrLibraryPromise = null;
                throw error;
            });

        return qrLibraryPromise;
    }


    /*
     * ------------------------------------------------------------
     * Contrast / Readability
     * ------------------------------------------------------------
     */

    function updateContrast() {
        if (!contrastStatus) {
            return;
        }

        const ratio =
            getContrastRatio(
                currentSettings.foreground,
                currentSettings.background
            );

        let status = "Poor";

        if (ratio >= 7) {
            status = "Excellent";
        } else if (ratio >= 4.5) {
            status = "Good";
        } else if (ratio >= 3) {
            status = "Low";
        }

        contrastStatus.textContent =
            status +
            " (" +
            ratio.toFixed(2) +
            ":1)";

        contrastStatus.setAttribute(
            "data-level",
            status.toLowerCase()
        );

        /*
         * Keep the status informative without relying
         * only on color.
         */
        if (ratio < 3) {
            contrastStatus.title =
                "Very low contrast. Consider using darker QR color or a lighter background.";
        } else if (ratio < 4.5) {
            contrastStatus.title =
                "Contrast is relatively low. A stronger contrast is recommended for reliable scanning.";
        } else {
            contrastStatus.title =
                "Strong contrast between the QR code and background.";
        }
    }


    function getContrastRatio(
        foreground,
        background
    ) {
        const foregroundRGB =
            hexToRGB(foreground);

        const backgroundRGB =
            hexToRGB(background);

        if (
            !foregroundRGB ||
            !backgroundRGB
        ) {
            return 1;
        }

        const foregroundLuminance =
            getRelativeLuminance(
                foregroundRGB
            );

        const backgroundLuminance =
            getRelativeLuminance(
                backgroundRGB
            );

        const lighter =
            Math.max(
                foregroundLuminance,
                backgroundLuminance
            );

        const darker =
            Math.min(
                foregroundLuminance,
                backgroundLuminance
            );

        return (
            (lighter + 0.05) /
            (darker + 0.05)
        );
    }


    function hexToRGB(hex) {
        const normalized =
            normalizeColor(hex);

        if (!normalized) {
            return null;
        }

        return {
            r: parseInt(
                normalized.substring(1, 3),
                16
            ),

            g: parseInt(
                normalized.substring(3, 5),
                16
            ),

            b: parseInt(
                normalized.substring(5, 7),
                16
            )
        };
    }


    function getRelativeLuminance(rgb) {
        const values = [
            rgb.r / 255,
            rgb.g / 255,
            rgb.b / 255
        ].map(function (value) {
            if (value <= 0.03928) {
                return value / 12.92;
            }

            return Math.pow(
                (value + 0.055) / 1.055,
                2.4
            );
        });

        return (
            0.2126 * values[0] +
            0.7152 * values[1] +
            0.0722 * values[2]
        );
    }


    /*
     * ------------------------------------------------------------
     * Reset
     * ------------------------------------------------------------
     */

    function resetCustomization() {
        currentSettings = {
            foreground:
                CONFIG.defaultSettings
                    .foreground,

            background:
                CONFIG.defaultSettings
                    .background,

            size:
                CONFIG.defaultSettings
                    .size,

            template:
                CONFIG.defaultSettings
                    .template
        };

        clearError();

        syncControlsWithSettings();
        updateContrast();

        renderQR();
    }


    /*
     * ------------------------------------------------------------
     * Download
     * ------------------------------------------------------------
     *
     * Use the shared download-system.js when available.
     * If the shared system is not loaded yet, load it once.
     */

    async function downloadCustomizedQR() {
        if (!currentPayload) {
            showError(
                "No QR code is available to download."
            );
            return;
        }

        const canvas =
            qrOutput
                ? qrOutput.querySelector(
                    "canvas"
                )
                : null;

        if (!canvas) {
            showError(
                "QR preview is not ready yet. Please wait and try again."
            );
            return;
        }

        try {
            await loadDownloadSystem();

            if (
                window.QRNAVI_DOWNLOAD &&
                typeof window.QRNAVI_DOWNLOAD
                    .downloadCanvas ===
                    "function"
            ) {
                const success =
                    window.QRNAVI_DOWNLOAD
                        .downloadCanvas(
                            canvas,
                            "qrnavi-qr-code.png"
                        );

                if (success) {
                    return;
                }
            }

            /*
             * Safe local fallback.
             * Normally the shared download system handles this.
             */
            fallbackCanvasDownload(canvas);

        } catch (error) {
            console.error(
                "QRNAVI: Customizer download failed.",
                error
            );

            fallbackCanvasDownload(canvas);
        }
    }


    function loadDownloadSystem() {
        if (
            window.QRNAVI_DOWNLOAD &&
            typeof window.QRNAVI_DOWNLOAD
                .downloadCanvas ===
                "function"
        ) {
            return Promise.resolve(
                window.QRNAVI_DOWNLOAD
            );
        }

        if (downloadSystemPromise) {
            return downloadSystemPromise;
        }

        downloadSystemPromise =
            new Promise(
                function (resolve, reject) {
                    const existingScript =
                        document.querySelector(
                            'script[src="' +
                            CONFIG.downloadSystemUrl +
                            '"]'
                        );

                    if (existingScript) {
                        existingScript.addEventListener(
                            "load",
                            function () {
                                if (
                                    window.QRNAVI_DOWNLOAD
                                ) {
                                    resolve(
                                        window.QRNAVI_DOWNLOAD
                                    );
                                } else {
                                    reject(
                                        new Error(
                                            "Download system API unavailable."
                                        )
                                    );
                                }
                            },
                            { once: true }
                        );

                        existingScript.addEventListener(
                            "error",
                            function () {
                                reject(
                                    new Error(
                                        "Download system failed to load."
                                    )
                                );
                            },
                            { once: true }
                        );

                        return;
                    }

                    const script =
                        document.createElement(
                            "script"
                        );

                    script.src =
                        CONFIG.downloadSystemUrl;

                    script.async = true;

                    script.onload =
                        function () {
                            if (
                                window.QRNAVI_DOWNLOAD
                            ) {
                                resolve(
                                    window.QRNAVI_DOWNLOAD
                                );
                            } else {
                                reject(
                                    new Error(
                                        "Download system API unavailable."
                                    )
                                );
                            }
                        };

                    script.onerror =
                        function () {
                            reject(
                                new Error(
                                    "Download system failed to load."
                                )
                            );
                        };

                    document.head.appendChild(
                        script
                    );
                }
            ).catch(function (error) {
                downloadSystemPromise = null;
                throw error;
            });

        return downloadSystemPromise;
    }


    function fallbackCanvasDownload(
        canvas
    ) {
        try {
            const dataURL =
                canvas.toDataURL(
                    "image/png"
                );

            const link =
                document.createElement(
                    "a"
                );

            link.href = dataURL;

            link.download =
                "qrnavi-qr-code.png";

            link.rel = "noopener";

            document.body.appendChild(
                link
            );

            link.click();

            link.remove();

        } catch (error) {
            console.error(
                "QRNAVI: Fallback PNG download failed.",
                error
            );

            showError(
                "PNG download failed. Please try again."
            );
        }
    }


    /*
     * ------------------------------------------------------------
     * Error handling
     * ------------------------------------------------------------
     */

    function showError(message) {
        if (!errorElement) {
            return;
        }

        errorElement.textContent =
            message;

        errorElement.hidden = false;
    }


    function clearError() {
        if (!errorElement) {
            return;
        }

        errorElement.textContent = "";
        errorElement.hidden = true;
    }


    /*
     * ------------------------------------------------------------
     * Public API
     * ------------------------------------------------------------
     */

    window.QRNAVI_CUSTOMIZER = {
        getPayload: function () {
            return currentPayload;
        },

        getType: function () {
            return currentType;
        },

        getSettings: function () {
            return {
                foreground:
                    currentSettings.foreground,

                background:
                    currentSettings.background,

                size:
                    currentSettings.size,

                template:
                    currentSettings.template
            };
        },

        render: renderQR,

        reset: resetCustomization,

        download: downloadCustomizedQR
    };


    /*
     * ------------------------------------------------------------
     * Start
     * ------------------------------------------------------------
     */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }
})();
