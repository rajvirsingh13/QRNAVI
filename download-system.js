"use strict";

/*
 * QRNAVI — Download System
 * ------------------------------------------------------------
 * Responsibilities:
 * 1. Detect when a QR code has been generated.
 * 2. Show ONLY Download + Customize actions after generation.
 * 3. Download the currently generated QR as PNG.
 * 4. Pass the current QR payload safely to qr-customizer.html.
 * 5. Keep the QR payload/data unchanged.
 * 6. Provide reusable download helpers for the customizer page.
 *
 * This file does NOT generate QR codes.
 * The QR generation engine remains inside script.js.
 */

(function () {
    const CONFIG = {
        outputId: "qr-output",
        previewId: "qr-preview",
        formId: "qr-generator-form",
        actionsId: "qrnavi-qr-actions",
        storageKey: "qrnaviCustomizerState",
        customizerPage: "qr-customizer.html",
        downloadFileName: "qrnavi-qr-code.png",
        observerDelay: 80
    };

    let observer = null;
    let refreshTimer = null;
    let lastQRSignature = "";
    let actionsElement = null;

    /*
     * ------------------------------------------------------------
     * Initialization
     * ------------------------------------------------------------
     */

    function init() {
        const output = document.getElementById(CONFIG.outputId);

        if (!output) {
            return;
        }

        createObserver(output);
        scheduleRefresh();

        /*
         * Listen for form submission/generation changes.
         * This does not generate anything itself.
         */
        const form = document.getElementById(CONFIG.formId);

        if (form) {
            form.addEventListener("submit", scheduleRefresh, false);
        }

        /*
         * Small delayed checks help when qrcodejs finishes rendering
         * asynchronously after script.js creates the QR.
         */
        window.setTimeout(scheduleRefresh, 150);
        window.setTimeout(scheduleRefresh, 400);
        window.setTimeout(scheduleRefresh, 800);
    }

    /*
     * ------------------------------------------------------------
     * QR Output Observer
     * ------------------------------------------------------------
     */

    function createObserver(output) {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(function () {
            scheduleRefresh();
        });

        observer.observe(output, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["src", "style", "width", "height"]
        });
    }

    function scheduleRefresh() {
        if (refreshTimer) {
            window.clearTimeout(refreshTimer);
        }

        refreshTimer = window.setTimeout(function () {
            refreshTimer = null;
            refreshQRInterface();
        }, CONFIG.observerDelay);
    }

    /*
     * ------------------------------------------------------------
     * QR Detection
     * ------------------------------------------------------------
     */

    function getQROutput() {
        return document.getElementById(CONFIG.outputId);
    }

    function getQRCanvas() {
        const output = getQROutput();

        if (!output) {
            return null;
        }

        return output.querySelector("canvas");
    }

    function getQRImage() {
        const output = getQROutput();

        if (!output) {
            return null;
        }

        const image = output.querySelector("img");

        if (!image) {
            return null;
        }

        if (!image.src) {
            return null;
        }

        return image;
    }

    function hasGeneratedQR() {
        const canvas = getQRCanvas();

        if (canvas && canvas.width > 0 && canvas.height > 0) {
            return true;
        }

        const image = getQRImage();

        if (image && image.complete && image.naturalWidth > 0) {
            return true;
        }

        return false;
    }

    function getCurrentPayload() {
        if (
            window.QRNAVI &&
            typeof window.QRNAVI.getCurrentPayload === "function"
        ) {
            try {
                const payload = window.QRNAVI.getCurrentPayload();

                if (typeof payload === "string" && payload.trim() !== "") {
                    return payload;
                }
            } catch (error) {
                console.warn(
                    "QRNAVI: Unable to read current QR payload.",
                    error
                );
            }
        }

        return "";
    }

    function getSelectedType() {
        if (
            window.QRNAVI &&
            typeof window.QRNAVI.getSelectedType === "function"
        ) {
            try {
                const type = window.QRNAVI.getSelectedType();

                if (typeof type === "string" && type.trim() !== "") {
                    return type;
                }
            } catch (error) {
                console.warn(
                    "QRNAVI: Unable to read selected QR type.",
                    error
                );
            }
        }

        const typeElement = document.getElementById("qr-type");

        if (typeElement && typeElement.value) {
            return typeElement.value;
        }

        return "unknown";
    }

    /*
     * ------------------------------------------------------------
     * QR Signature
     * ------------------------------------------------------------
     *
     * Used to prevent unnecessary recreation of buttons while
     * qrcodejs changes the output DOM.
     */

    function getQRSignature() {
        const payload = getCurrentPayload();

        const canvas = getQRCanvas();

        if (canvas) {
            return [
                "canvas",
                canvas.width,
                canvas.height,
                payload
            ].join("|");
        }

        const image = getQRImage();

        if (image) {
            return [
                "image",
                image.src,
                image.width,
                image.height,
                payload
            ].join("|");
        }

        return "";
    }

    /*
     * ------------------------------------------------------------
     * Main UI Refresh
     * ------------------------------------------------------------
     */

    function refreshQRInterface() {
        const output = getQROutput();

        if (!output) {
            return;
        }

        const qrExists = hasGeneratedQR();

        if (!qrExists) {
            removeActionButtons();
            lastQRSignature = "";
            return;
        }

        /*
         * Make sure the generated QR is visibly present.
         * We do not change the QR itself.
         */
        makeQRVisible(output);

        const signature = getQRSignature();

        if (!signature) {
            return;
        }

        /*
         * If the same QR is already handled, do nothing.
         */
        if (
            signature === lastQRSignature &&
            actionsElement &&
            document.body.contains(actionsElement)
        ) {
            return;
        }

        lastQRSignature = signature;

        createActionButtons();
    }

    function makeQRVisible(output) {
        output.hidden = false;

        /*
         * Only remove common hidden state.
         * Existing layout/design remains untouched.
         */
        if (output.getAttribute("aria-hidden") === "true") {
            output.setAttribute("aria-hidden", "false");
        }
    }

    /*
     * ------------------------------------------------------------
     * Action Buttons
     * ------------------------------------------------------------
     */

    function createActionButtons() {
        const preview = document.getElementById(CONFIG.previewId);

        if (!preview) {
            return;
        }

        /*
         * Never create duplicate controls.
         */
        removeActionButtons();

        const actions = document.createElement("div");

        actions.id = CONFIG.actionsId;
        actions.className = "qrnavi-qr-actions";
        actions.setAttribute("aria-label", "QR code actions");

        const downloadButton = document.createElement("button");

        downloadButton.type = "button";
        downloadButton.className = "nav-button qrnavi-download-button";
        downloadButton.textContent = "Download";
        downloadButton.setAttribute(
            "aria-label",
            "Download generated QR code as PNG"
        );

        downloadButton.addEventListener("click", function () {
            downloadCurrentQR();
        });

        const customizeButton = document.createElement("button");

        customizeButton.type = "button";
        customizeButton.className =
            "secondary-button qrnavi-customize-button";
        customizeButton.textContent = "Customize";
        customizeButton.setAttribute(
            "aria-label",
            "Customize generated QR code"
        );

        customizeButton.addEventListener("click", function () {
            openCustomizer();
        });

        actions.appendChild(downloadButton);
        actions.appendChild(customizeButton);

        /*
         * Add controls directly after the QR preview/output.
         * The buttons therefore appear only after a QR exists.
         */
        const output = getQROutput();

        if (output && output.parentElement) {
            output.parentElement.appendChild(actions);
        } else {
            preview.appendChild(actions);
        }

        actionsElement = actions;

        injectActionStyles();
    }

    function removeActionButtons() {
        const existing = document.getElementById(CONFIG.actionsId);

        if (existing) {
            existing.remove();
        }

        actionsElement = null;
    }

    /*
     * ------------------------------------------------------------
     * Download Current QR
     * ------------------------------------------------------------
     */

    function downloadCurrentQR() {
        const canvas = getQRCanvas();

        if (canvas) {
            downloadCanvasAsPNG(canvas);
            return;
        }

        const image = getQRImage();

        if (image) {
            downloadImageAsPNG(image);
            return;
        }

        showDownloadError(
            "QR code is not ready yet. Please generate the QR code again."
        );
    }

    function downloadCanvasAsPNG(canvas) {
        try {
            if (
                typeof canvas.toDataURL !== "function" ||
                canvas.width <= 0 ||
                canvas.height <= 0
            ) {
                throw new Error("Invalid QR canvas.");
            }

            const dataURL = canvas.toDataURL("image/png");

            triggerDownload(dataURL, CONFIG.downloadFileName);
        } catch (error) {
            console.error(
                "QRNAVI: PNG download failed.",
                error
            );

            showDownloadError(
                "Download failed. Please generate the QR code again."
            );
        }
    }

    function downloadImageAsPNG(image) {
        /*
         * qrcodejs normally creates a canvas, so this is a fallback.
         * We convert the image into a canvas before downloading.
         */
        try {
            const width =
                image.naturalWidth ||
                image.width ||
                320;

            const height =
                image.naturalHeight ||
                image.height ||
                320;

            const canvas = document.createElement("canvas");

            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");

            if (!context) {
                throw new Error("Canvas context unavailable.");
            }

            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);

            context.drawImage(
                image,
                0,
                0,
                width,
                height
            );

            const dataURL = canvas.toDataURL("image/png");

            triggerDownload(dataURL, CONFIG.downloadFileName);
        } catch (error) {
            console.error(
                "QRNAVI: Image-to-PNG conversion failed.",
                error
            );

            /*
             * If canvas conversion is blocked, try the image directly.
             */
            if (image.src) {
                triggerDownload(
                    image.src,
                    CONFIG.downloadFileName
                );
            } else {
                showDownloadError(
                    "Download failed. Please generate the QR code again."
                );
            }
        }
    }

    function triggerDownload(dataURL, fileName) {
        if (!dataURL) {
            showDownloadError(
                "Download failed. QR image data is unavailable."
            );
            return;
        }

        const link = document.createElement("a");

        link.href = dataURL;
        link.download = fileName;
        link.rel = "noopener";

        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    /*
     * ------------------------------------------------------------
     * Customize Flow
     * ------------------------------------------------------------
     */

    function openCustomizer() {
        const payload = getCurrentPayload();

        if (!payload) {
            showDownloadError(
                "QR data is unavailable. Please generate the QR code again."
            );
            return;
        }

        const selectedType = getSelectedType();

        const state = {
            version: 1,
            payload: payload,
            type: selectedType,
            createdAt: Date.now()
        };

        try {
            sessionStorage.setItem(
                CONFIG.storageKey,
                JSON.stringify(state)
            );
        } catch (error) {
            console.error(
                "QRNAVI: Unable to save customizer state.",
                error
            );

            showDownloadError(
                "Customizer could not be opened. Please try again."
            );

            return;
        }

        /*
         * No QR payload is placed in the URL.
         * This keeps data such as WiFi credentials out of the
         * browser address bar.
         */
        window.location.href = CONFIG.customizerPage;
    }

    /*
     * ------------------------------------------------------------
     * Customizer State API
     * ------------------------------------------------------------
     *
     * qr-customizer.js can use these methods later.
     */

    function getCustomizerState() {
        try {
            const stored = sessionStorage.getItem(
                CONFIG.storageKey
            );

            if (!stored) {
                return null;
            }

            const state = JSON.parse(stored);

            if (!state || typeof state !== "object") {
                return null;
            }

            if (
                typeof state.payload !== "string" ||
                state.payload.trim() === ""
            ) {
                return null;
            }

            return state;
        } catch (error) {
            console.warn(
                "QRNAVI: Unable to read customizer state.",
                error
            );

            return null;
        }
    }

    function clearCustomizerState() {
        try {
            sessionStorage.removeItem(CONFIG.storageKey);
        } catch (error) {
            console.warn(
                "QRNAVI: Unable to clear customizer state.",
                error
            );
        }
    }

    /*
     * ------------------------------------------------------------
     * Reusable Canvas Download API
     * ------------------------------------------------------------
     *
     * The future customizer can call:
     * QRNAVI_DOWNLOAD.downloadCanvas(canvas)
     *
     * This keeps PNG download logic in one place.
     */

    function downloadCanvas(canvas, fileName) {
        if (!canvas) {
            return false;
        }

        try {
            if (
                typeof canvas.toDataURL !== "function" ||
                canvas.width <= 0 ||
                canvas.height <= 0
            ) {
                return false;
            }

            const dataURL = canvas.toDataURL("image/png");

            triggerDownload(
                dataURL,
                fileName || CONFIG.downloadFileName
            );

            return true;
        } catch (error) {
            console.error(
                "QRNAVI: Canvas download failed.",
                error
            );

            return false;
        }
    }

    /*
     * ------------------------------------------------------------
     * Error Message
     * ------------------------------------------------------------
     */

    function showDownloadError(message) {
        const output = getQROutput();

        if (!output || !output.parentElement) {
            return;
        }

        const existing = output.parentElement.querySelector(
            ".qrnavi-download-error"
        );

        if (existing) {
            existing.textContent = message;
            return;
        }

        const errorElement = document.createElement("p");

        errorElement.className = "qrnavi-download-error";
        errorElement.textContent = message;
        errorElement.setAttribute("role", "alert");

        output.parentElement.appendChild(errorElement);

        window.setTimeout(function () {
            if (errorElement && errorElement.parentNode) {
                errorElement.remove();
            }
        }, 4000);

        injectActionStyles();
    }

    /*
     * ------------------------------------------------------------
     * Minimal Action Styles
     * ------------------------------------------------------------
     *
     * Existing QRNAVI buttons remain untouched.
     * These styles only handle the new action row.
     */

    function injectActionStyles() {
        if (document.getElementById("qrnavi-download-system-styles")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "qrnavi-download-system-styles";

        style.textContent = `
            .qrnavi-qr-actions {
                width: 100%;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: center;
                gap: 12px;
                margin: 18px auto 0;
            }

            .qrnavi-qr-actions button {
                min-height: 46px;
                cursor: pointer;
            }

            .qrnavi-download-button,
            .qrnavi-customize-button {
                min-width: 150px;
            }

            .qrnavi-download-error {
                width: 100%;
                margin: 12px 0 0;
                text-align: center;
                font-size: 0.92rem;
                line-height: 1.5;
                color: #b42318;
            }

            @media (max-width: 520px) {
                .qrnavi-qr-actions {
                    flex-direction: column;
                    gap: 10px;
                }

                .qrnavi-download-button,
                .qrnavi-customize-button {
                    width: 100%;
                    max-width: 320px;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .qrnavi-qr-actions button {
                    transition: none !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /*
     * ------------------------------------------------------------
     * Public QRNAVI Download API
     * ------------------------------------------------------------
     */

    window.QRNAVI_DOWNLOAD = {
        downloadCurrentQR: downloadCurrentQR,
        downloadCanvas: downloadCanvas,
        openCustomizer: openCustomizer,
        getCustomizerState: getCustomizerState,
        clearCustomizerState: clearCustomizerState,
        getQRCanvas: getQRCanvas,
        getQRImage: getQRImage
    };

    /*
     * ------------------------------------------------------------
     * Start
     * ------------------------------------------------------------
     */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }
})();
