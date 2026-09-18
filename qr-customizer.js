"use strict";

/*
 * QRNAVI — QR Customizer
 * ------------------------------------------------------------
 * Responsibilities:
 * - Load QR data from sessionStorage
 * - Live QR customization
 * - Templates
 * - QR / background colors
 * - HEX colors
 * - Preset colors
 * - QR size
 * - Contrast/readability warning
 * - Safe-download protection
 * - Reliable PNG export with proper quiet zone
 *
 * IMPORTANT:
 * - QR payload/data is never changed by customization.
 * - No Apply button is required.
 * - Download is disabled when the color combination is unsafe.
 * - Exported PNG always gets a proper quiet zone around the QR.
 */

const QRNAVI_CUSTOMIZER_CONFIG = {
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
     * WCAG-style minimum contrast.
     * 4.5:1 is used conservatively for QR readability.
     */
    minimumContrastRatio: 4.5,

    /*
     * Quiet zone:
     * QR standards recommend a clear area around the QR.
     * 10% of the final image gives a strong margin for
     * different QR densities and scanner conditions.
     */
    quietZoneRatio: 0.10,

    renderDelay: 60
};


/* ============================================================
   DOM REFERENCES
   ============================================================ */

const DOM = {
    qrOutput: null,
    emptyState: null,
    error: null,

    templateCards: [],

    qrColorPicker: null,
    qrColorHex: null,
    qrColorPresets: null,

    backgroundColorPicker: null,
    backgroundColorHex: null,
    backgroundColorPresets: null,

    sizeOptions: [],

    contrastFeedback: null,
    contrastStatus: null,

    resetButton: null,
    downloadButton: null
};


/* ============================================================
   STATE
   ============================================================ */

const STATE = {
    payload: "",
    type: "",

    settings: {
        ...QRNAVI_CUSTOMIZER_CONFIG.defaultSettings
    },

    qrLibraryPromise: null,

    renderTimer: null,

    isRendering: false,

    hasRenderedCurrentSettings: false
};


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", initCustomizer);


function initCustomizer() {
    cacheDOM();

    bindEvents();

    const savedState = getSavedState();

    if (!savedState || !savedState.payload) {
        showEmptyState();
        disableControls(true);
        return;
    }

    STATE.payload = String(savedState.payload);
    STATE.type = String(savedState.type || "");

    STATE.settings = {
        ...QRNAVI_CUSTOMIZER_CONFIG.defaultSettings,
        ...(savedState.settings || {})
    };

    normalizeSettings();

    hideEmptyState();
    disableControls(false);

    syncControls();

    updateReadabilityFeedback();

    markDownloadPending();

    renderQR();
}


/* ============================================================
   DOM CACHE
   ============================================================ */

function cacheDOM() {
    DOM.qrOutput = document.getElementById("customizer-qr-output");
    DOM.emptyState = document.getElementById("customizer-empty-state");
    DOM.error = document.getElementById("customizer-error");

    DOM.templateCards = Array.from(
        document.querySelectorAll(".template-card")
    );

    DOM.qrColorPicker = document.getElementById("qr-color-picker");
    DOM.qrColorHex = document.getElementById("qr-color-hex");
    DOM.qrColorPresets = document.getElementById("qr-color-presets");

    DOM.backgroundColorPicker = document.getElementById(
        "background-color-picker"
    );

    DOM.backgroundColorHex = document.getElementById(
        "background-color-hex"
    );

    DOM.backgroundColorPresets = document.getElementById(
        "background-color-presets"
    );

    DOM.sizeOptions = Array.from(
        document.querySelectorAll(".size-option")
    );

    DOM.contrastFeedback = document.getElementById(
        "contrast-feedback"
    );

    DOM.contrastStatus = document.getElementById(
        "contrast-status"
    );

    DOM.resetButton = document.getElementById(
        "reset-customization"
    );

    DOM.downloadButton = document.getElementById(
        "customizer-download"
    );

    if (DOM.error) {
        DOM.error.setAttribute("aria-live", "polite");
    }

    if (DOM.contrastFeedback) {
        DOM.contrastFeedback.setAttribute("aria-live", "polite");
    }
}


/* ============================================================
   EVENT BINDINGS
   ============================================================ */

function bindEvents() {
    DOM.templateCards.forEach((card) => {
        card.addEventListener("click", () => {
            const template = card.dataset.template || "";

            applyTemplate(template);
        });
    });


    if (DOM.qrColorPicker) {
        DOM.qrColorPicker.addEventListener("input", (event) => {
            const value = normalizeHex(event.target.value);

            if (!value) {
                return;
            }

            STATE.settings.foreground = value;
            STATE.settings.template = "custom";

            markDownloadPending();
            syncControls();
            updateReadabilityFeedback();
            scheduleRender();
        });
    }


    if (DOM.qrColorHex) {
        DOM.qrColorHex.addEventListener("input", (event) => {
            const value = normalizeHex(event.target.value);

            if (!value) {
                /*
                 * Do not destroy the current valid QR color while
                 * the user is typing a HEX value.
                 */
                return;
            }

            STATE.settings.foreground = value;
            STATE.settings.template = "custom";

            markDownloadPending();
            syncControls();
            updateReadabilityFeedback();
            scheduleRender();
        });
    }


    if (DOM.backgroundColorPicker) {
        DOM.backgroundColorPicker.addEventListener(
            "input",
            (event) => {
                const value = normalizeHex(event.target.value);

                if (!value) {
                    return;
                }

                STATE.settings.background = value;
                STATE.settings.template = "custom";

                markDownloadPending();
                syncControls();
                updateReadabilityFeedback();
                scheduleRender();
            }
        );
    }


    if (DOM.backgroundColorHex) {
        DOM.backgroundColorHex.addEventListener(
            "input",
            (event) => {
                const value = normalizeHex(event.target.value);

                if (!value) {
                    return;
                }

                STATE.settings.background = value;
                STATE.settings.template = "custom";

                markDownloadPending();
                syncControls();
                updateReadabilityFeedback();
                scheduleRender();
            }
        );
    }


    bindPresetEvents(DOM.qrColorPresets, "foreground");

    bindPresetEvents(
        DOM.backgroundColorPresets,
        "background"
    );


    DOM.sizeOptions.forEach((option) => {
        option.addEventListener("click", () => {
            const size = Number(option.dataset.size);

            if (!Number.isFinite(size)) {
                return;
            }

            STATE.settings.size = clampSize(size);

            markDownloadPending();
            syncControls();
            scheduleRender();
        });
    });


    if (DOM.resetButton) {
        DOM.resetButton.addEventListener("click", resetCustomization);
    }


    if (DOM.downloadButton) {
        DOM.downloadButton.addEventListener(
            "click",
            downloadCustomizedQR
        );
    }
}


/* ============================================================
   PRESET EVENTS
   ============================================================ */

function bindPresetEvents(container, target) {
    if (!container) {
        return;
    }

    const buttons = Array.from(
        container.querySelectorAll("[data-color]")
    );

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const value = normalizeHex(
                button.dataset.color || ""
            );

            if (!value) {
                return;
            }

            if (target === "foreground") {
                STATE.settings.foreground = value;
            } else {
                STATE.settings.background = value;
            }

            STATE.settings.template = "custom";

            markDownloadPending();
            syncControls();
            updateReadabilityFeedback();
            scheduleRender();
        });
    });
}


/* ============================================================
   TEMPLATE SYSTEM
   ============================================================ */

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

        /*
         * Darker blue is intentionally used here so the
         * built-in template remains sufficiently readable.
         */
        modern: {
            foreground: "#145DA0",
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

        /*
         * Darker blue + light background for reliable contrast.
         */
        professional: {
            foreground: "#0B63CE",
            background: "#F0F7FF"
        }
    };

    const selected = templates[template];

    if (!selected) {
        return;
    }

    STATE.settings.template = template;
    STATE.settings.foreground = selected.foreground;
    STATE.settings.background = selected.background;

    markDownloadPending();

    syncControls();

    updateReadabilityFeedback();

    scheduleRender();
}


/* ============================================================
   STATE NORMALIZATION
   ============================================================ */

function normalizeSettings() {
    const foreground =
        normalizeHex(STATE.settings.foreground);

    const background =
        normalizeHex(STATE.settings.background);

    STATE.settings.foreground =
        foreground ||
        QRNAVI_CUSTOMIZER_CONFIG.defaultSettings.foreground;

    STATE.settings.background =
        background ||
        QRNAVI_CUSTOMIZER_CONFIG.defaultSettings.background;

    STATE.settings.size =
        clampSize(STATE.settings.size);

    if (
        typeof STATE.settings.template !== "string" ||
        !STATE.settings.template
    ) {
        STATE.settings.template = "classic";
    }
}


function clampSize(size) {
    const numericSize = Number(size);

    const allowedSizes = [220, 320, 400, 512];

    if (allowedSizes.includes(numericSize)) {
        return numericSize;
    }

    return 320;
}


/* ============================================================
   SAVED STATE
   ============================================================ */

function getSavedState() {
    try {
        /*
         * Shared download system is preferred when available.
         */
        if (
            window.QRNAVI_DOWNLOAD &&
            typeof window.QRNAVI_DOWNLOAD.getCustomizerState ===
                "function"
        ) {
            const state =
                window.QRNAVI_DOWNLOAD.getCustomizerState();

            if (state) {
                return state;
            }
        }
    } catch (error) {
        console.warn(
            "QRNAVI: Unable to read shared customizer state.",
            error
        );
    }


    try {
        const raw = sessionStorage.getItem(
            QRNAVI_CUSTOMIZER_CONFIG.storageKey
        );

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.warn(
            "QRNAVI: Unable to read sessionStorage state.",
            error
        );

        return null;
    }
}


/* ============================================================
   CONTROL SYNC
   ============================================================ */

function syncControls() {
    if (DOM.qrColorPicker) {
        DOM.qrColorPicker.value =
            STATE.settings.foreground;
    }

    if (DOM.qrColorHex) {
        DOM.qrColorHex.value =
            STATE.settings.foreground;
    }

    if (DOM.backgroundColorPicker) {
        DOM.backgroundColorPicker.value =
            STATE.settings.background;
    }

    if (DOM.backgroundColorHex) {
        DOM.backgroundColorHex.value =
            STATE.settings.background;
    }


    DOM.sizeOptions.forEach((option) => {
        const optionSize = Number(option.dataset.size);

        option.classList.toggle(
            "active",
            optionSize === STATE.settings.size
        );

        option.setAttribute(
            "aria-pressed",
            optionSize === STATE.settings.size
                ? "true"
                : "false"
        );
    });


    DOM.templateCards.forEach((card) => {
        const isActive =
            card.dataset.template === STATE.settings.template;

        card.classList.toggle("active", isActive);

        card.setAttribute(
            "aria-pressed",
            isActive ? "true" : "false"
        );
    });
}


/* ============================================================
   READABILITY / COLOR SAFETY
   ============================================================ */

function updateReadabilityFeedback() {
    if (!DOM.contrastStatus && !DOM.contrastFeedback) {
        return;
    }

    const result = getColorSafetyResult();

    if (DOM.contrastStatus) {
        DOM.contrastStatus.textContent =
            `Contrast ratio: ${result.ratio.toFixed(2)}:1`;
    }


    if (!DOM.contrastFeedback) {
        return;
    }


    if (result.safe) {
        DOM.contrastFeedback.textContent =
            "✓ Good QR contrast. This color combination is suitable for download.";

        DOM.contrastFeedback.classList.remove(
            "warning",
            "danger",
            "unsafe"
        );

        DOM.contrastFeedback.classList.add("safe");

        return;
    }


    if (!result.darkOnLight) {
        DOM.contrastFeedback.textContent =
            "⚠️ For better scanner compatibility, use a darker QR color on a lighter background. Download is disabled.";

        DOM.contrastFeedback.classList.remove(
            "safe"
        );

        DOM.contrastFeedback.classList.add(
            "warning",
            "unsafe"
        );

        return;
    }


    DOM.contrastFeedback.textContent =
        `⚠️ QR contrast is too low (${result.ratio.toFixed(
            2
        )}:1). Choose a darker QR color or a lighter background. Download is disabled.`;

    DOM.contrastFeedback.classList.remove(
        "safe"
    );

    DOM.contrastFeedback.classList.add(
        "warning",
        "unsafe"
    );
}


/*
 * Conservative QR safety check.
 *
 * Requirements:
 * 1. Contrast must be at least 4.5:1.
 * 2. QR foreground must be darker than background.
 *
 * This does NOT claim mathematical guarantee that every scanner
 * will read every QR. It simply blocks combinations that are
 * known to be less reliable.
 */
function getColorSafetyResult() {
    const foreground =
        normalizeHex(STATE.settings.foreground);

    const background =
        normalizeHex(STATE.settings.background);

    if (!foreground || !background) {
        return {
            ratio: 0,
            darkOnLight: false,
            safe: false
        };
    }


    const foregroundRGB =
        hexToRGB(foreground);

    const backgroundRGB =
        hexToRGB(background);


    if (!foregroundRGB || !backgroundRGB) {
        return {
            ratio: 0,
            darkOnLight: false,
            safe: false
        };
    }


    const foregroundLuminance =
        getRelativeLuminance(foregroundRGB);

    const backgroundLuminance =
        getRelativeLuminance(backgroundRGB);


    const ratio =
        getContrastRatio(
            foregroundLuminance,
            backgroundLuminance
        );


    const darkOnLight =
        foregroundLuminance < backgroundLuminance;


    const safe =
        ratio >=
            QRNAVI_CUSTOMIZER_CONFIG.minimumContrastRatio &&
        darkOnLight;


    return {
        ratio,
        darkOnLight,
        safe
    };
}


/* ============================================================
   COLOR MATH
   ============================================================ */

function normalizeHex(value) {
    if (typeof value !== "string") {
        return null;
    }

    const cleaned = value.trim();

    if (!/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
        return null;
    }

    return cleaned.toUpperCase();
}


function hexToRGB(hex) {
    const normalized = normalizeHex(hex);

    if (!normalized) {
        return null;
    }

    return {
        r: parseInt(normalized.slice(1, 3), 16),
        g: parseInt(normalized.slice(3, 5), 16),
        b: parseInt(normalized.slice(5, 7), 16)
    };
}


function getRelativeLuminance(rgb) {
    const values = [
        rgb.r / 255,
        rgb.g / 255,
        rgb.b / 255
    ].map((value) => {
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


function getContrastRatio(luminanceA, luminanceB) {
    const lighter =
        Math.max(luminanceA, luminanceB);

    const darker =
        Math.min(luminanceA, luminanceB);

    return (
        (lighter + 0.05) /
        (darker + 0.05)
    );
}


/* ============================================================
   RENDER SCHEDULING
   ============================================================ */

function scheduleRender() {
    clearTimeout(STATE.renderTimer);

    markDownloadPending();

    STATE.renderTimer = setTimeout(() => {
        renderQR();
    }, QRNAVI_CUSTOMIZER_CONFIG.renderDelay);
}


/* ============================================================
   QR RENDER
   ============================================================ */

async function renderQR() {
    if (!DOM.qrOutput) {
        return;
    }

    if (!STATE.payload) {
        return;
    }

    if (STATE.isRendering) {
        return;
    }


    STATE.isRendering = true;

    STATE.hasRenderedCurrentSettings = false;

    setDownloadEnabled(false);

    clearError();

    try {
        const QRCodeConstructor =
            await loadQRCodeLibrary();


        /*
         * Settings can change while the library is loading.
         * Read them only after the library is ready.
         */
        const payload = STATE.payload;

        const finalSize =
            clampSize(STATE.settings.size);

        const foreground =
            normalizeHex(STATE.settings.foreground) ||
            QRNAVI_CUSTOMIZER_CONFIG.defaultSettings.foreground;

        const background =
            normalizeHex(STATE.settings.background) ||
            QRNAVI_CUSTOMIZER_CONFIG.defaultSettings.background;


        /*
         * Proper QR quiet zone.
         *
         * Instead of generating the QR directly edge-to-edge,
         * generate the QR inside an inner canvas and place it
         * onto a larger final canvas with a clean background.
         */
        const quietZone = Math.max(
            16,
            Math.round(
                finalSize *
                    QRNAVI_CUSTOMIZER_CONFIG.quietZoneRatio
            )
        );


        const innerSize =
            finalSize - quietZone * 2;


        if (innerSize <= 0) {
            throw new Error(
                "QR preview size is too small."
            );
        }


        /*
         * Temporary container for QRCode.js.
         */
        const tempContainer =
            document.createElement("div");

        tempContainer.setAttribute(
            "aria-hidden",
            "true"
        );

        tempContainer.style.position = "absolute";
        tempContainer.style.left = "-100000px";
        tempContainer.style.top = "0";
        tempContainer.style.width =
            `${innerSize}px`;
        tempContainer.style.height =
            `${innerSize}px`;
        tempContainer.style.overflow = "hidden";

        document.body.appendChild(tempContainer);


        try {
            new QRCodeConstructor(tempContainer, {
                text: payload,

                width: innerSize,

                height: innerSize,

                colorDark: foreground,

                colorLight: background,

                correctLevel:
                    QRCodeConstructor.CorrectLevel.M
            });


            /*
             * QRCode.js creates its canvas asynchronously in some
             * browser situations, so locate the canvas carefully.
             */
            const sourceCanvas =
                await waitForCanvas(tempContainer);


            /*
             * Final canvas.
             *
             * This is the canvas displayed in the customizer
             * and later exported.
             */
            const finalCanvas =
                document.createElement("canvas");

            finalCanvas.width = finalSize;
            finalCanvas.height = finalSize;

            finalCanvas.setAttribute(
                "role",
                "img"
            );

            finalCanvas.setAttribute(
                "aria-label",
                "Customized QR code"
            );


            /*
             * alpha:false ensures an opaque PNG background.
             */
            const context =
                finalCanvas.getContext(
                    "2d",
                    {
                        alpha: false
                    }
                );


            if (!context) {
                throw new Error(
                    "Unable to create QR canvas."
                );
            }


            /*
             * Paint the complete background first.
             */
            context.fillStyle = background;

            context.fillRect(
                0,
                0,
                finalSize,
                finalSize
            );


            /*
             * Disable image smoothing so QR modules remain
             * sharp and square.
             */
            context.imageSmoothingEnabled = false;


            /*
             * Place QR inside the quiet zone.
             */
            context.drawImage(
                sourceCanvas,
                quietZone,
                quietZone,
                innerSize,
                innerSize
            );


            /*
             * Replace preview with the final QR canvas.
             */
            DOM.qrOutput.innerHTML = "";

            DOM.qrOutput.appendChild(finalCanvas);


            STATE.hasRenderedCurrentSettings = true;

            updateReadabilityFeedback();

            updateDownloadAvailability(finalCanvas);
        } finally {
            tempContainer.remove();
        }
    } catch (error) {
        console.error(
            "QRNAVI customizer render error:",
            error
        );

        STATE.hasRenderedCurrentSettings = false;

        setDownloadEnabled(false);

        showError(
            "QR code could not be generated. Please try again."
        );
    } finally {
        STATE.isRendering = false;

        /*
         * If settings changed during rendering, schedule a
         * fresh render using the latest settings.
         */
        if (
            STATE.renderTimer === null &&
            STATE.hasRenderedCurrentSettings
        ) {
            updateDownloadAvailability(
                getPreviewCanvas()
            );
        }
    }
}


/* ============================================================
   CANVAS WAIT
   ============================================================ */

function waitForCanvas(container) {
    return new Promise((resolve, reject) => {
        const existingCanvas =
            container.querySelector("canvas");

        if (existingCanvas) {
            resolve(existingCanvas);
            return;
        }


        let attempts = 0;

        const maxAttempts = 100;

        const timer = setInterval(() => {
            attempts += 1;

            const canvas =
                container.querySelector("canvas");

            if (canvas) {
                clearInterval(timer);
                resolve(canvas);
                return;
            }


            if (attempts >= maxAttempts) {
                clearInterval(timer);

                reject(
                    new Error(
                        "QR canvas was not created."
                    )
                );
            }
        }, 20);
    });
}


/* ============================================================
   QR LIBRARY LOADER
   ============================================================ */

function loadQRCodeLibrary() {
    if (window.QRCode) {
        return Promise.resolve(window.QRCode);
    }


    if (STATE.qrLibraryPromise) {
        return STATE.qrLibraryPromise;
    }


    STATE.qrLibraryPromise =
        new Promise((resolve, reject) => {
            const existingScript =
                document.querySelector(
                    'script[data-qrnavi-qrcode-library="true"]'
                );


            if (existingScript) {
                existingScript.addEventListener(
                    "load",
                    () => {
                        if (window.QRCode) {
                            resolve(window.QRCode);
                        } else {
                            reject(
                                new Error(
                                    "QRCode library loaded but is unavailable."
                                )
                            );
                        }
                    },
                    { once: true }
                );


                existingScript.addEventListener(
                    "error",
                    () => {
                        reject(
                            new Error(
                                "QRCode library failed to load."
                            )
                        );
                    },
                    { once: true }
                );

                return;
            }


            const script =
                document.createElement("script");

            script.src =
                QRNAVI_CUSTOMIZER_CONFIG.qrLibraryUrl;

            script.async = true;

            script.dataset.qrnaviQrcodeLibrary =
                "true";


            script.onload = () => {
                if (window.QRCode) {
                    resolve(window.QRCode);
                } else {
                    reject(
                        new Error(
                            "QRCode library loaded but is unavailable."
                        )
                    );
                }
            };


            script.onerror = () => {
                reject(
                    new Error(
                        "Unable to load QRCode library."
                    )
                );
            };


            document.head.appendChild(script);
        });


    return STATE.qrLibraryPromise;
}


/* ============================================================
   PREVIEW CANVAS
   ============================================================ */

function getPreviewCanvas() {
    if (!DOM.qrOutput) {
        return null;
    }

    return DOM.qrOutput.querySelector("canvas");
}


/* ============================================================
   DOWNLOAD AVAILABILITY
   ============================================================ */

function markDownloadPending() {
    STATE.hasRenderedCurrentSettings = false;

    setDownloadEnabled(false);
}


function updateDownloadAvailability(canvas) {
    if (!DOM.downloadButton) {
        return;
    }


    if (!canvas) {
        setDownloadEnabled(false);
        return;
    }


    if (STATE.isRendering) {
        setDownloadEnabled(false);
        return;
    }


    if (!STATE.hasRenderedCurrentSettings) {
        setDownloadEnabled(false);
        return;
    }


    const safety =
        getColorSafetyResult();


    if (!safety.safe) {
        setDownloadEnabled(false);
        return;
    }


    setDownloadEnabled(true);
}


function setDownloadEnabled(enabled) {
    if (!DOM.downloadButton) {
        return;
    }

    DOM.downloadButton.disabled = !enabled;

    DOM.downloadButton.setAttribute(
        "aria-disabled",
        enabled ? "false" : "true"
    );


    if (enabled) {
        DOM.downloadButton.removeAttribute(
            "title"
        );
    } else {
        DOM.downloadButton.setAttribute(
            "title",
            "Choose a safer QR color combination and wait for the preview to update."
        );
    }
}


/* ============================================================
   DOWNLOAD
   ============================================================ */

async function downloadCustomizedQR() {
    /*
     * Re-check safety immediately before download.
     * This prevents downloading an unsafe QR even if some
     * browser/event timing causes a stale button state.
     */
    const safety =
        getColorSafetyResult();


    if (!safety.safe) {
        updateReadabilityFeedback();

        setDownloadEnabled(false);

        return;
    }


    if (STATE.isRendering) {
        return;
    }


    if (!STATE.hasRenderedCurrentSettings) {
        return;
    }


    const sourceCanvas =
        getPreviewCanvas();


    if (!sourceCanvas) {
        showError(
            "QR preview is not ready yet. Please wait a moment and try again."
        );

        setDownloadEnabled(false);

        return;
    }


    try {
        /*
         * Create a fresh opaque export canvas.
         *
         * This prevents transparent-background issues and ensures
         * the exact current background is included in the PNG.
         */
        const exportCanvas =
            createOpaqueExportCanvas(
                sourceCanvas
            );


        if (
            window.QRNAVI_DOWNLOAD &&
            typeof window.QRNAVI_DOWNLOAD.downloadCanvas ===
                "function"
        ) {
            window.QRNAVI_DOWNLOAD.downloadCanvas(
                exportCanvas,
                "qrnavi-qr-code.png"
            );

            return;
        }


        /*
         * If download-system.js is not available, load it.
         */
        await loadDownloadSystem();


        if (
            window.QRNAVI_DOWNLOAD &&
            typeof window.QRNAVI_DOWNLOAD.downloadCanvas ===
                "function"
        ) {
            window.QRNAVI_DOWNLOAD.downloadCanvas(
                exportCanvas,
                "qrnavi-qr-code.png"
            );

            return;
        }


        /*
         * Final local fallback.
         */
        downloadCanvasLocally(
            exportCanvas,
            "qrnavi-qr-code.png"
        );
    } catch (error) {
        console.error(
            "QRNAVI customizer download error:",
            error
        );

        showError(
            "Download failed. Please try again."
        );
    }
}


/* ============================================================
   OPAQUE EXPORT CANVAS
   ============================================================ */

function createOpaqueExportCanvas(sourceCanvas) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;


    const exportCanvas =
        document.createElement("canvas");

    exportCanvas.width = width;
    exportCanvas.height = height;


    const context =
        exportCanvas.getContext(
            "2d",
            {
                alpha: false
            }
        );


    if (!context) {
        throw new Error(
            "Unable to create export canvas."
        );
    }


    const background =
        normalizeHex(
            STATE.settings.background
        ) ||
        QRNAVI_CUSTOMIZER_CONFIG
            .defaultSettings
            .background;


    /*
     * Force a completely opaque background.
     */
    context.fillStyle = background;

    context.fillRect(
        0,
        0,
        width,
        height
    );


    /*
     * Preserve exact QR modules.
     */
    context.imageSmoothingEnabled = false;

    context.drawImage(
        sourceCanvas,
        0,
        0
    );


    return exportCanvas;
}


/* ============================================================
   DOWNLOAD SYSTEM LOADER
   ============================================================ */

function loadDownloadSystem() {
    return new Promise((resolve, reject) => {
        if (
            window.QRNAVI_DOWNLOAD &&
            typeof window.QRNAVI_DOWNLOAD.downloadCanvas ===
                "function"
        ) {
            resolve(window.QRNAVI_DOWNLOAD);
            return;
        }


        const existingScript =
            document.querySelector(
                'script[data-qrnavi-download-system="true"]'
            );


        if (existingScript) {
            existingScript.addEventListener(
                "load",
                () => {
                    if (
                        window.QRNAVI_DOWNLOAD &&
                        typeof window.QRNAVI_DOWNLOAD.downloadCanvas ===
                            "function"
                    ) {
                        resolve(
                            window.QRNAVI_DOWNLOAD
                        );
                    } else {
                        reject(
                            new Error(
                                "Download system loaded but is unavailable."
                            )
                        );
                    }
                },
                { once: true }
            );


            existingScript.addEventListener(
                "error",
                () => {
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
            document.createElement("script");

        script.src =
            QRNAVI_CUSTOMIZER_CONFIG.downloadSystemUrl;

        script.async = true;

        script.dataset.qrnaviDownloadSystem =
            "true";


        script.onload = () => {
            if (
                window.QRNAVI_DOWNLOAD &&
                typeof window.QRNAVI_DOWNLOAD.downloadCanvas ===
                    "function"
            ) {
                resolve(
                    window.QRNAVI_DOWNLOAD
                );
            } else {
                reject(
                    new Error(
                        "Download system loaded but is unavailable."
                    )
                );
            }
        };


        script.onerror = () => {
            reject(
                new Error(
                    "Unable to load download system."
                )
            );
        };


        document.body.appendChild(script);
    });
}


/* ============================================================
   LOCAL DOWNLOAD FALLBACK
   ============================================================ */

function downloadCanvasLocally(
    canvas,
    filename
) {
    const dataUrl =
        canvas.toDataURL("image/png");


    const link =
        document.createElement("a");

    link.href = dataUrl;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();
}


/* ============================================================
   RESET
   ============================================================ */

function resetCustomization() {
    clearTimeout(STATE.renderTimer);

    STATE.renderTimer = null;

    STATE.settings = {
        ...QRNAVI_CUSTOMIZER_CONFIG.defaultSettings
    };


    markDownloadPending();

    clearError();

    syncControls();

    updateReadabilityFeedback();

    renderQR();
}


/* ============================================================
   UI HELPERS
   ============================================================ */

function disableControls(disabled) {
    const controls = [
        ...DOM.templateCards,
        DOM.qrColorPicker,
        DOM.qrColorHex,
        DOM.backgroundColorPicker,
        DOM.backgroundColorHex,
        ...DOM.sizeOptions,
        DOM.resetButton,
        DOM.downloadButton
    ].filter(Boolean);


    controls.forEach((control) => {
        control.disabled = disabled;
    });


    if (disabled) {
        setDownloadEnabled(false);
    }
}


function showEmptyState() {
    if (DOM.emptyState) {
        DOM.emptyState.hidden = false;
    }

    if (DOM.qrOutput) {
        DOM.qrOutput.innerHTML = "";
    }

    clearError();

    setDownloadEnabled(false);
}


function hideEmptyState() {
    if (DOM.emptyState) {
        DOM.emptyState.hidden = true;
    }
}


function showError(message) {
    if (!DOM.error) {
        return;
    }

    DOM.error.textContent = message;

    DOM.error.hidden = false;

    DOM.error.setAttribute(
        "role",
        "alert"
    );
}


function clearError() {
    if (!DOM.error) {
        return;
    }

    DOM.error.textContent = "";

    DOM.error.hidden = true;

    DOM.error.removeAttribute(
        "role"
    );
}


/* ============================================================
   PUBLIC API
   ============================================================ */

window.QRNAVI_CUSTOMIZER = {
    getPayload: () => STATE.payload,

    getType: () => STATE.type,

    getSettings: () => ({
        ...STATE.settings
    }),

    getColorSafety: () =>
        getColorSafetyResult(),

    render: renderQR,

    reset: resetCustomization,

    download: downloadCustomizedQR
};
