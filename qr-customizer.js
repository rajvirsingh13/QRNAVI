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
 * 9. Warn immediately when selected colors may reduce scanning.
 * 10. Disable PNG download while QR colors are unsafe.
 * 11. Enable PNG download automatically when colors are safe.
 * 12. Reset customization instantly.
 * 13. Download the current customized QR as PNG.
 *
 * Important:
 * - There is NO Apply button.
 * - QR payload/data never changes.
 * - This page is intentionally desktop-only.
 * - No logo/pattern/frame feature is faked.
 * - Unsafe color combinations cannot be downloaded.
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

        /*
         * Minimum contrast required for a downloadable QR.
         *
         * 4.5:1 is used as a conservative readability
         * threshold for the foreground/background pair.
         */
        minimumContrastRatio: 4.5,

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
    let downloadButton = null;

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
            document.getElementById(
                "customizer-qr-output"
            );

        emptyState =
            document.getElementById(
                "customizer-empty-state"
            );

        errorElement =
            document.getElementById(
                "customizer-error"
            );

        contrastStatus =
            document.getElementById(
                "contrast-status"
            );

        downloadButton =
            document.getElementById(
                "customizer-download"
            );

        qrColorPicker =
            document.getElementById(
                "qr-color-picker"
            );

        qrColorHex =
            document.getElementById(
                "qr-color-hex"
            );

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

        currentPayload =
            state.payload;

        currentType =
            typeof state.type === "string" &&
            state.type.trim() !== ""
                ? state.type
                : "unknown";

        hideEmptyState();

        syncControlsWithSettings();

        updateContrast();

        updateDownloadAvailability();

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

            const parsed =
                JSON.parse(stored);

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

        updateDownloadAvailability();
    }


    function hideEmptyState() {
        if (emptyState) {
            emptyState.hidden = true;
        }

        if (qrOutput) {
            qrOutput.hidden = false;
        }

        enableCustomizerControls();

        updateDownloadAvailability();
    }


    function disableCustomizerControls() {
        const controls =
            document.querySelectorAll(
                ".customizer-controls button, " +
                ".customizer-controls input"
            );

        controls.forEach(function (control) {
            if (
                control.id !==
                "reset-customization"
            ) {
                control.disabled = true;
            }
        });

        /*
         * Reset remains available.
         */
        if (downloadButton) {
            downloadButton.disabled = true;
        }
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

        updateDownloadAvailability();
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
        /*
         * Templates use deliberately readable
         * dark-foreground/light-background combinations.
         */
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
                foreground: "#5B21B6",
                background: "#FFFFFF"
            },

            modern: {
                foreground: "#155EAC",
                background: "#F7F9FC"
            },

            minimal: {
                foreground: "#344054",
                background: "#FFFFFF"
            },

            colorful: {
                foreground: "#9F1239",
                background: "#FFF7ED"
            },

            professional: {
                foreground: "#0759A8",
                background: "#F0F7FF"
            }
        };

        const selected =
            templates[template];

        if (!selected) {
            return;
        }

        currentSettings.template =
            template;

        currentSettings.foreground =
            selected.foreground;

        currentSettings.background =
            selected.background;

        updateTemplateButtons();

        syncColorControls();

        updateContrast();

        updateDownloadAvailability();

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
                ) ===
                currentSettings.template;

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

                    updateDownloadAvailability();

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

                    updateDownloadAvailability();

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

                    currentSettings[
                        settingName
                    ] = color;

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

                    updateDownloadAvailability();

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
                .replace(
                    /[^a-fA-F0-9]/g,
                    ""
                )
                .slice(
                    0,
                    CONFIG.minHexLength
                );

        input.value =
            value.toUpperCase();

        /*
         * Do not change the active color until
         * a complete 6-digit HEX value exists.
         */
        if (
            value.length !==
            CONFIG.minHexLength
        ) {
            updateDownloadAvailability();
            return;
        }

        const color =
            normalizeColor(
                "#" + value
            );

        if (!color) {
            updateDownloadAvailability();
            return;
        }

        currentSettings[
            settingName
        ] = color;

        currentSettings.template =
            "custom";

        updateTemplateButtons();

        updateContrast();

        updateDownloadAvailability();

        scheduleRender();
    }


    function finalizeHexInput(
        input,
        settingName
    ) {
        let value =
            input.value
                .replace(/^#/g, "")
                .replace(
                    /[^a-fA-F0-9]/g,
                    ""
                )
                .toUpperCase();

        if (
            value.length !==
            CONFIG.minHexLength
        ) {
            syncColorControls();

            updateContrast();

            updateDownloadAvailability();

            return;
        }

        const color =
            normalizeColor(
                "#" + value
            );

        if (!color) {
            syncColorControls();

            updateContrast();

            updateDownloadAvailability();

            return;
        }

        currentSettings[
            settingName
        ] = color;

        input.value =
            color.substring(1);

        currentSettings.template =
            "custom";

        updateTemplateButtons();

        updateContrast();

        updateDownloadAvailability();

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
                        !Number.isFinite(
                            size
                        ) ||
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
             * Recreate the preview with the same payload.
             *
             * Only visual settings change.
             */
            qrOutput.innerHTML = "";

            new window.QRCode(
                qrOutput,
                {
                    text:
                        currentPayload,

                    width:
                        currentSettings.size,

                    height:
                        currentSettings.size,

                    colorDark:
                        currentSettings.foreground,

                    colorLight:
                        currentSettings.background,

                    correctLevel:
                        window.QRCode
                            .CorrectLevel
                            .M
                }
            );

            qrOutput.setAttribute(
                "aria-label",
                "Live customized QR code preview"
            );

            updateContrast();

            updateDownloadAvailability();

        } catch (error) {
            console.error(
                "QRNAVI: QR rendering failed.",
                error
            );

            showError(
                "The QR preview could not be updated. Please try again."
            );

            updateDownloadAvailability();

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
                function (
                    resolve,
                    reject
                ) {
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
                            {
                                once: true
                            }
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
                            {
                                once: true
                            }
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
            ).catch(
                function (error) {
                    qrLibraryPromise = null;

                    throw error;
                }
            );

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

        const foregroundRGB =
            hexToRGB(
                currentSettings.foreground
            );

        const backgroundRGB =
            hexToRGB(
                currentSettings.background
            );

        const foregroundLuminance =
            foregroundRGB
                ? getRelativeLuminance(
                    foregroundRGB
                )
                : 1;

        const backgroundLuminance =
            backgroundRGB
                ? getRelativeLuminance(
                    backgroundRGB
                )
                : 1;

        /*
         * QRNAVI intentionally prefers:
         *
         * DARK QR
         * +
         * LIGHT BACKGROUND
         *
         * This is more broadly compatible with QR scanners
         * than allowing every mathematically high-contrast
         * color direction.
         */
        const correctColorDirection =
            foregroundLuminance <
            backgroundLuminance;

        let status = "Poor";

        if (
            ratio >= 7 &&
            correctColorDirection
        ) {
            status = "Excellent";

        } else if (
            ratio >=
                CONFIG.minimumContrastRatio &&
            correctColorDirection
        ) {
            status = "Good";

        } else if (
            ratio >= 3 &&
            correctColorDirection
        ) {
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
         * --------------------------------------------------------
         * Warning logic
         * --------------------------------------------------------
         */

        if (
            ratio <
                CONFIG.minimumContrastRatio ||
            !correctColorDirection
        ) {
            showUnsafeColorWarning(
                ratio,
                correctColorDirection
            );

        } else {
            clearUnsafeColorWarning();
        }
    }


    function showUnsafeColorWarning(
        ratio,
        correctColorDirection
    ) {
        if (!errorElement) {
            return;
        }

        let message =
            "Warning: These colors may make the QR code difficult to scan. ";

        if (
            !correctColorDirection
        ) {
            message +=
                "Please choose a darker QR color and a lighter background.";
        } else {
            message +=
                "Please choose colors with stronger contrast. A minimum contrast of " +
                CONFIG.minimumContrastRatio.toFixed(
                    1
                ) +
                ":1 is required for download.";
        }

        errorElement.textContent =
            message;

        errorElement.hidden = false;

        errorElement.setAttribute(
            "role",
            "alert"
        );

        errorElement.setAttribute(
            "data-type",
            "unsafe-color"
        );
    }


    function clearUnsafeColorWarning() {
        if (!errorElement) {
            return;
        }

        if (
            errorElement.getAttribute(
                "data-type"
            ) === "unsafe-color"
        ) {
            errorElement.textContent = "";

            errorElement.hidden = true;

            errorElement.removeAttribute(
                "data-type"
            );
        }
    }


    function getContrastRatio(
        foreground,
        background
    ) {
        const foregroundRGB =
            hexToRGB(
                foreground
            );

        const backgroundRGB =
            hexToRGB(
                background
            );

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
                normalized.substring(
                    1,
                    3
                ),
                16
            ),

            g: parseInt(
                normalized.substring(
                    3,
                    5
                ),
                16
            ),

            b: parseInt(
                normalized.substring(
                    5,
                    7
                ),
                16
            )
        };
    }


    function getRelativeLuminance(
        rgb
    ) {
        const values = [
            rgb.r / 255,
            rgb.g / 255,
            rgb.b / 255
        ].map(
            function (value) {
                if (
                    value <=
                    0.03928
                ) {
                    return (
                        value /
                        12.92
                    );
                }

                return Math.pow(
                    (
                        value +
                        0.055
                    ) /
                        1.055,
                    2.4
                );
            }
        );

        return (
            0.2126 *
                values[0] +
            0.7152 *
                values[1] +
            0.0722 *
                values[2]
        );
    }


    /*
     * ------------------------------------------------------------
     * Download safety
     * ------------------------------------------------------------
     */

    function isColorCombinationSafe() {
        const ratio =
            getContrastRatio(
                currentSettings.foreground,
                currentSettings.background
            );

        const foregroundRGB =
            hexToRGB(
                currentSettings.foreground
            );

        const backgroundRGB =
            hexToRGB(
                currentSettings.background
            );

        if (
            !foregroundRGB ||
            !backgroundRGB
        ) {
            return false;
        }

        const foregroundLuminance =
            getRelativeLuminance(
                foregroundRGB
            );

        const backgroundLuminance =
            getRelativeLuminance(
                backgroundRGB
            );

        const correctColorDirection =
            foregroundLuminance <
            backgroundLuminance;

        return (
            ratio >=
                CONFIG.minimumContrastRatio &&
            correctColorDirection
        );
    }


    function updateDownloadAvailability() {
        if (!downloadButton) {
            return;
        }

        /*
         * No payload = no download.
         */
        if (!currentPayload) {
            downloadButton.disabled = true;

            downloadButton.setAttribute(
                "aria-disabled",
                "true"
            );

            return;
        }

        const safe =
            isColorCombinationSafe();

        downloadButton.disabled =
            !safe;

        downloadButton.setAttribute(
            "aria-disabled",
            String(!safe)
        );

        if (safe) {
            downloadButton.title =
                "Download the current customized QR as PNG.";
        } else {
            downloadButton.title =
                "Download is disabled because the selected colors may reduce QR scanning reliability.";
        }
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

        updateDownloadAvailability();

        renderQR();
    }


    /*
     * ------------------------------------------------------------
     * Download
     * ------------------------------------------------------------
     *
     * Download is allowed ONLY when the selected
     * foreground/background combination passes the
     * readability safety check.
     */

    async function downloadCustomizedQR() {
        if (!currentPayload) {
            showError(
                "No QR code is available to download."
            );

            updateDownloadAvailability();

            return;
        }

        /*
         * Final safety check.
         *
         * Even if the browser somehow triggers the button
         * while disabled, unsafe QR must never be downloaded.
         */
        if (!isColorCombinationSafe()) {
            showUnsafeColorWarning(
                getContrastRatio(
                    currentSettings.foreground,
                    currentSettings.background
                ),
                isDarkForegroundOnLightBackground()
            );

            updateDownloadAvailability();

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

        /*
         * Prevent downloading while a render is still active.
         */
        if (isRendering) {
            showError(
                "QR preview is still updating. Please wait a moment and try again."
            );

            return;
        }

        try {
            await loadDownloadSystem();

            /*
             * Re-check safety after asynchronous loading.
             */
            if (!isColorCombinationSafe()) {
                updateDownloadAvailability();

                return;
            }

            if (
                window.QRNAVI_DOWNLOAD &&
                typeof window
                    .QRNAVI_DOWNLOAD
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
                    clearUnsafeColorWarning();

                    updateDownloadAvailability();

                    return;
                }
            }

            /*
             * Safe local fallback.
             */
            fallbackCanvasDownload(
                canvas
            );

        } catch (error) {
            console.error(
                "QRNAVI: Customizer download failed.",
                error
            );

            fallbackCanvasDownload(
                canvas
            );
        }
    }


    function isDarkForegroundOnLightBackground() {
        const foregroundRGB =
            hexToRGB(
                currentSettings.foreground
            );

        const backgroundRGB =
            hexToRGB(
                currentSettings.background
            );

        if (
            !foregroundRGB ||
            !backgroundRGB
        ) {
            return false;
        }

        return (
            getRelativeLuminance(
                foregroundRGB
            ) <
            getRelativeLuminance(
                backgroundRGB
            )
        );
    }


    /*
     * ------------------------------------------------------------
     * Shared download-system.js loader
     * ------------------------------------------------------------
     */

    function loadDownloadSystem() {
        if (
            window.QRNAVI_DOWNLOAD &&
            typeof window
                .QRNAVI_DOWNLOAD
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
                function (
                    resolve,
                    reject
                ) {
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
                            {
                                once: true
                            }
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
                            {
                                once: true
                            }
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
            ).catch(
                function (error) {
                    downloadSystemPromise =
                        null;

                    throw error;
                }
            );

        return downloadSystemPromise;
    }


    /*
     * ------------------------------------------------------------
     * Fallback PNG download
     * ------------------------------------------------------------
     */

    function fallbackCanvasDownload(
        canvas
    ) {
        try {
            /*
             * Final safety check before creating
             * the downloadable PNG.
             */
            if (
                !isColorCombinationSafe()
            ) {
                updateDownloadAvailability();

                return;
            }

            const dataURL =
                canvas.toDataURL(
                    "image/png"
                );

            const link =
                document.createElement(
                    "a"
                );

            link.href =
                dataURL;

            link.download =
                "qrnavi-qr-code.png";

            link.rel =
                "noopener";

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

        errorElement.setAttribute(
            "role",
            "alert"
        );
    }


    function clearError() {
        if (!errorElement) {
            return;
        }

        /*
         * Do not blindly clear an unsafe-color warning here.
         * updateContrast() owns that warning state.
         */
        if (
            errorElement.getAttribute(
                "data-type"
            ) === "unsafe-color"
        ) {
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
                    currentSettings
                        .foreground,

                background:
                    currentSettings
                        .background,

                size:
                    currentSettings.size,

                template:
                    currentSettings
                        .template
            };
        },

        render: renderQR,

        reset:
            resetCustomization,

        download:
            downloadCustomizedQR,

        isColorSafe:
            isColorCombinationSafe
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
            {
                once: true
            }
        );
    } else {
        init();
    }
})();
