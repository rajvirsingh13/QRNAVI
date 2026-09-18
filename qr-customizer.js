"use strict";

/*
 * ============================================================
 * QRNAVI — Premium QR Customizer
 * ============================================================
 *
 * Purpose:
 * - Adds a premium QR editor to the existing generator.
 * - Keeps the QR payload/data unchanged.
 * - Provides live customization:
 *      • Templates
 *      • QR foreground color
 *      • Background color
 *      • HEX color inputs
 *      • Preset colors
 *      • QR size
 *      • Readability / contrast feedback
 *      • Reset
 *      • Apply
 * - Designed for mobile-first and desktop layouts.
 * - Does NOT create a download system.
 * - download-system.js will handle downloading later.
 *
 * Dependencies:
 * - index.html
 * - style.css
 * - script.js
 *
 * Existing QRNAVI API used:
 * - window.QRNAVI.getCurrentQRCode()
 * - window.QRNAVI.getQRCodeOutput()
 * - window.QRNAVI.getCurrentPayload()
 * - window.QRNAVI.getSelectedType()
 *
 * ============================================================
 */

(function () {
  const CUSTOMIZER_ID = "qrnavi-customizer";

  const DEFAULTS = {
    foreground: "#071426",
    background: "#ffffff",
    size: 320,
    template: "classic"
  };

  const SIZE_OPTIONS = [
    {
      value: 220,
      label: "Small",
      description: "Compact"
    },
    {
      value: 320,
      label: "Standard",
      description: "Recommended"
    },
    {
      value: 400,
      label: "Large",
      description: "High resolution"
    },
    {
      value: 512,
      label: "XL",
      description: "Print friendly"
    }
  ];

  const COLOR_PRESETS = [
    {
      name: "Classic",
      foreground: "#071426",
      background: "#ffffff"
    },
    {
      name: "Ocean",
      foreground: "#0f5ed7",
      background: "#ffffff"
    },
    {
      name: "Midnight",
      foreground: "#111827",
      background: "#dbeafe"
    },
    {
      name: "Royal",
      foreground: "#4338ca",
      background: "#ffffff"
    },
    {
      name: "Forest",
      foreground: "#166534",
      background: "#f0fdf4"
    },
    {
      name: "Berry",
      foreground: "#9f1239",
      background: "#fff1f2"
    },
    {
      name: "Slate",
      foreground: "#334155",
      background: "#f8fafc"
    },
    {
      name: "Dark",
      foreground: "#ffffff",
      background: "#071426"
    }
  ];

  const TEMPLATES = [
    {
      id: "classic",
      name: "Classic",
      description: "Clean & universal",
      foreground: "#071426",
      background: "#ffffff"
    },
    {
      id: "business",
      name: "Business",
      description: "Professional & sharp",
      foreground: "#0f172a",
      background: "#f8fafc"
    },
    {
      id: "social",
      name: "Social",
      description: "Modern & expressive",
      foreground: "#4338ca",
      background: "#eef2ff"
    },
    {
      id: "modern",
      name: "Modern",
      description: "Fresh & minimal",
      foreground: "#0369a1",
      background: "#f0f9ff"
    },
    {
      id: "minimal",
      name: "Minimal",
      description: "Simple & elegant",
      foreground: "#334155",
      background: "#ffffff"
    },
    {
      id: "colorful",
      name: "Colorful",
      description: "Bright & creative",
      foreground: "#be123c",
      background: "#fff1f2"
    },
    {
      id: "professional",
      name: "Professional",
      description: "Premium dark style",
      foreground: "#ffffff",
      background: "#071426"
    }
  ];

  let state = {
    ...DEFAULTS
  };

  let appliedState = {
    ...DEFAULTS
  };

  let initialized = false;
  let observer = null;
  let customizerElement = null;

  /*
   * ------------------------------------------------------------
   * Initialization
   * ------------------------------------------------------------
   */

  function init() {
    if (initialized) {
      return;
    }

    const output = getOutputElement();

    if (!output) {
      return;
    }

    /*
     * The customizer is intentionally created only after the
     * generator has produced a QR code.
     */
    if (!hasQRCode(output)) {
      watchForQRCode(output);
      return;
    }

    createCustomizer(output);
  }

  function watchForQRCode(output) {
    if (observer) {
      return;
    }

    observer = new MutationObserver(function () {
      if (hasQRCode(output)) {
        observer.disconnect();
        observer = null;
        createCustomizer(output);
      }
    });

    observer.observe(output, {
      childList: true,
      subtree: true
    });

    /*
     * Safety fallback for cases where the QR library updates
     * the DOM in a way MutationObserver does not immediately
     * expose.
     */
    let attempts = 0;

    const interval = window.setInterval(function () {
      attempts += 1;

      if (hasQRCode(output)) {
        window.clearInterval(interval);

        if (observer) {
          observer.disconnect();
          observer = null;
        }

        createCustomizer(output);
      }

      if (attempts >= 40) {
        window.clearInterval(interval);
      }
    }, 250);
  }

  /*
   * ------------------------------------------------------------
   * DOM helpers
   * ------------------------------------------------------------
   */

  function getOutputElement() {
    return document.getElementById("qr-output");
  }

  function hasQRCode(output) {
    if (!output) {
      return false;
    }

    return Boolean(
      output.querySelector("canvas") ||
      output.querySelector("img")
    );
  }

  /*
   * ------------------------------------------------------------
   * Create Premium Editor
   * ------------------------------------------------------------
   */

  function createCustomizer(output) {
    if (initialized || document.getElementById(CUSTOMIZER_ID)) {
      initialized = true;
      return;
    }

    const parent = output.parentElement;

    if (!parent) {
      return;
    }

    customizerElement = document.createElement("section");
    customizerElement.id = CUSTOMIZER_ID;
    customizerElement.className = "qrnavi-customizer";
    customizerElement.setAttribute(
      "aria-labelledby",
      "qrnavi-customizer-title"
    );

    customizerElement.innerHTML = buildCustomizerHTML();

    injectCustomizerStyles();

    parent.insertAdjacentElement(
      "afterend",
      customizerElement
    );

    bindEvents();

    updateUI();

    initialized = true;
  }

  function buildCustomizerHTML() {
    return `
      <div class="qrnavi-customizer-shell">

        <div class="qrnavi-customizer-header">
          <div>
            <span class="qrnavi-editor-eyebrow">
              QR EDITOR
            </span>

            <h2 id="qrnavi-customizer-title">
              Customize your QR
            </h2>

            <p>
              Create a polished QR code while keeping your
              original information unchanged.
            </p>
          </div>

          <div class="qrnavi-editor-status">
            <span class="qrnavi-status-dot"></span>
            <span>Live Preview</span>
          </div>
        </div>


        <!-- ==================================================
             Templates
             ================================================== -->

        <div class="qrnavi-editor-section">
          <div class="qrnavi-section-title-row">
            <div>
              <h3>Choose a style</h3>
              <p>Start with a professionally balanced preset.</p>
            </div>
          </div>

          <div
            class="qrnavi-template-grid"
            id="qrnavi-template-grid"
          >
            ${TEMPLATES.map(buildTemplateCard).join("")}
          </div>
        </div>


        <!-- ==================================================
             Color Controls
             ================================================== -->

        <div class="qrnavi-editor-section">

          <div class="qrnavi-section-title-row">
            <div>
              <h3>Colors</h3>
              <p>
                Use high-contrast colors for reliable scanning.
              </p>
            </div>
          </div>


          <div class="qrnavi-color-presets">

            <div class="qrnavi-control-label-row">
              <span>Quick presets</span>
            </div>

            <div
              class="qrnavi-preset-grid"
              id="qrnavi-preset-grid"
            >
              ${COLOR_PRESETS.map(buildPresetButton).join("")}
            </div>

          </div>


          <div class="qrnavi-color-editor-grid">

            <div class="qrnavi-color-card">

              <div class="qrnavi-color-card-heading">
                <span class="qrnavi-color-swatch qrnavi-foreground-swatch"></span>

                <div>
                  <strong>QR color</strong>
                  <small>Foreground</small>
                </div>
              </div>

              <div class="qrnavi-color-input-row">

                <input
                  type="color"
                  id="qrnavi-foreground-picker"
                  aria-label="QR foreground color"
                  value="${DEFAULTS.foreground}"
                >

                <input
                  type="text"
                  id="qrnavi-foreground-hex"
                  class="qrnavi-hex-input"
                  value="${DEFAULTS.foreground}"
                  maxlength="7"
                  inputmode="text"
                  autocomplete="off"
                  spellcheck="false"
                  aria-label="QR foreground HEX color"
                >

              </div>

            </div>


            <div class="qrnavi-color-card">

              <div class="qrnavi-color-card-heading">
                <span class="qrnavi-color-swatch qrnavi-background-swatch"></span>

                <div>
                  <strong>Background</strong>
                  <small>QR background</small>
                </div>
              </div>

              <div class="qrnavi-color-input-row">

                <input
                  type="color"
                  id="qrnavi-background-picker"
                  aria-label="QR background color"
                  value="${DEFAULTS.background}"
                >

                <input
                  type="text"
                  id="qrnavi-background-hex"
                  class="qrnavi-hex-input"
                  value="${DEFAULTS.background}"
                  maxlength="7"
                  inputmode="text"
                  autocomplete="off"
                  spellcheck="false"
                  aria-label="QR background HEX color"
                >

              </div>

            </div>

          </div>


          <div
            class="qrnavi-contrast-box"
            id="qrnavi-contrast-box"
            role="status"
            aria-live="polite"
          >
            <span class="qrnavi-contrast-icon">✓</span>

            <div>
              <strong id="qrnavi-contrast-title">
                Good contrast
              </strong>

              <p id="qrnavi-contrast-message">
                These colors should provide good QR readability.
              </p>
            </div>
          </div>

        </div>


        <!-- ==================================================
             Size
             ================================================== -->

        <div class="qrnavi-editor-section">

          <div class="qrnavi-section-title-row">
            <div>
              <h3>QR size</h3>
              <p>
                Select the size that fits your use case.
              </p>
            </div>

            <span
              class="qrnavi-size-value"
              id="qrnavi-size-value"
            >
              320 × 320
            </span>
          </div>


          <div
            class="qrnavi-size-grid"
            id="qrnavi-size-grid"
          >
            ${SIZE_OPTIONS.map(buildSizeOption).join("")}
          </div>

        </div>


        <!-- ==================================================
             Reliability
             ================================================== -->

        <div class="qrnavi-editor-section qrnavi-reliability-section">

          <div class="qrnavi-reliability-card">

            <div class="qrnavi-reliability-icon">
              ✓
            </div>

            <div>
              <strong>Scanning reliability comes first</strong>

              <p>
                QRNAVI keeps your QR data unchanged and checks
                color contrast before applying your design.
              </p>
            </div>

          </div>

        </div>


        <!-- ==================================================
             Actions
             ================================================== -->

        <div class="qrnavi-editor-actions">

          <button
            type="button"
            class="qrnavi-reset-button"
            id="qrnavi-reset-button"
          >
            Reset
          </button>

          <button
            type="button"
            class="qrnavi-apply-button"
            id="qrnavi-apply-button"
          >
            <span>Apply customization</span>
            <span class="qrnavi-apply-arrow">→</span>
          </button>

        </div>


        <div
          class="qrnavi-editor-note"
          id="qrnavi-editor-note"
        >
          Your QR information stays exactly the same.
        </div>

      </div>
    `;
  }

  function buildTemplateCard(template) {
    const isActive = template.id === DEFAULTS.template;

    return `
      <button
        type="button"
        class="qrnavi-template-card${isActive ? " is-active" : ""}"
        data-template="${escapeAttribute(template.id)}"
        aria-pressed="${isActive ? "true" : "false"}"
      >

        <span
          class="qrnavi-template-preview"
          style="
            --template-fg:${template.foreground};
            --template-bg:${template.background};
          "
        >
          <span class="qrnavi-mini-qr">
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
          </span>
        </span>

        <span class="qrnavi-template-info">
          <strong>${escapeHTML(template.name)}</strong>
          <small>${escapeHTML(template.description)}</small>
        </span>

        <span class="qrnavi-template-check">✓</span>

      </button>
    `;
  }

  function buildPresetButton(preset) {
    return `
      <button
        type="button"
        class="qrnavi-preset-button"
        data-preset="${escapeAttribute(preset.name)}"
        title="${escapeAttribute(preset.name)}"
        aria-label="${escapeAttribute(preset.name)} color preset"
      >
        <span
          class="qrnavi-preset-preview"
          style="
            --preset-fg:${preset.foreground};
            --preset-bg:${preset.background};
          "
        ></span>

        <span>${escapeHTML(preset.name)}</span>
      </button>
    `;
  }

  function buildSizeOption(option) {
    const active = option.value === DEFAULTS.size;

    return `
      <button
        type="button"
        class="qrnavi-size-option${active ? " is-active" : ""}"
        data-size="${option.value}"
        aria-pressed="${active ? "true" : "false"}"
      >
        <strong>${escapeHTML(option.label)}</strong>
        <span>${escapeHTML(option.description)}</span>
        <small>${option.value}px</small>
      </button>
    `;
  }

  /*
   * ------------------------------------------------------------
   * Event binding
   * ------------------------------------------------------------
   */

  function bindEvents() {
    if (!customizerElement) {
      return;
    }

    const templateGrid =
      customizerElement.querySelector("#qrnavi-template-grid");

    const presetGrid =
      customizerElement.querySelector("#qrnavi-preset-grid");

    const sizeGrid =
      customizerElement.querySelector("#qrnavi-size-grid");

    const foregroundPicker =
      customizerElement.querySelector("#qrnavi-foreground-picker");

    const backgroundPicker =
      customizerElement.querySelector("#qrnavi-background-picker");

    const foregroundHex =
      customizerElement.querySelector("#qrnavi-foreground-hex");

    const backgroundHex =
      customizerElement.querySelector("#qrnavi-background-hex");

    const resetButton =
      customizerElement.querySelector("#qrnavi-reset-button");

    const applyButton =
      customizerElement.querySelector("#qrnavi-apply-button");


    if (templateGrid) {
      templateGrid.addEventListener("click", function (event) {
        const button = event.target.closest(
          "[data-template]"
        );

        if (!button) {
          return;
        }

        const templateId =
          button.getAttribute("data-template");

        applyTemplate(templateId);
      });
    }


    if (presetGrid) {
      presetGrid.addEventListener("click", function (event) {
        const button = event.target.closest(
          "[data-preset]"
        );

        if (!button) {
          return;
        }

        const presetName =
          button.getAttribute("data-preset");

        applyPreset(presetName);
      });
    }


    if (sizeGrid) {
      sizeGrid.addEventListener("click", function (event) {
        const button = event.target.closest(
          "[data-size]"
        );

        if (!button) {
          return;
        }

        const size = Number(
          button.getAttribute("data-size")
        );

        if (!Number.isFinite(size)) {
          return;
        }

        state.size = size;

        renderPreview();
        updateUI();
      });
    }


    if (foregroundPicker) {
      foregroundPicker.addEventListener(
        "input",
        function (event) {
          const color = normalizeHex(
            event.target.value
          );

          if (!color) {
            return;
          }

          state.foreground = color;
          state.template = "custom";

          renderPreview();
          updateUI();
        }
      );
    }


    if (backgroundPicker) {
      backgroundPicker.addEventListener(
        "input",
        function (event) {
          const color = normalizeHex(
            event.target.value
          );

          if (!color) {
            return;
          }

          state.background = color;
          state.template = "custom";

          renderPreview();
          updateUI();
        }
      );
    }


    if (foregroundHex) {
      foregroundHex.addEventListener(
        "input",
        function (event) {
          const value = event.target.value.trim();

          if (!isValidHex(value)) {
            markInvalidInput(foregroundHex, true);
            return;
          }

          markInvalidInput(foregroundHex, false);

          state.foreground =
            value.toUpperCase();

          state.template = "custom";

          syncColorPicker(
            "foreground",
            state.foreground
          );

          renderPreview();
          updateUI();
        }
      );

      foregroundHex.addEventListener(
        "blur",
        function () {
          const value = normalizeHex(
            foregroundHex.value
          );

          if (!value) {
            foregroundHex.value = state.foreground;
            markInvalidInput(foregroundHex, false);
            return;
          }

          state.foreground = value;

          foregroundHex.value =
            value.toUpperCase();

          markInvalidInput(foregroundHex, false);

          syncColorPicker(
            "foreground",
            state.foreground
          );

          renderPreview();
          updateUI();
        }
      );
    }


    if (backgroundHex) {
      backgroundHex.addEventListener(
        "input",
        function (event) {
          const value = event.target.value.trim();

          if (!isValidHex(value)) {
            markInvalidInput(backgroundHex, true);
            return;
          }

          markInvalidInput(backgroundHex, false);

          state.background =
            value.toUpperCase();

          state.template = "custom";

          syncColorPicker(
            "background",
            state.background
          );

          renderPreview();
          updateUI();
        }
      );

      backgroundHex.addEventListener(
        "blur",
        function () {
          const value = normalizeHex(
            backgroundHex.value
          );

          if (!value) {
            backgroundHex.value = state.background;
            markInvalidInput(backgroundHex, false);
            return;
          }

          state.background = value;

          backgroundHex.value =
            value.toUpperCase();

          markInvalidInput(backgroundHex, false);

          syncColorPicker(
            "background",
            state.background
          );

          renderPreview();
          updateUI();
        }
      );
    }


    if (resetButton) {
      resetButton.addEventListener(
        "click",
        resetCustomizer
      );
    }


    if (applyButton) {
      applyButton.addEventListener(
        "click",
        applyCustomization
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * Templates
   * ------------------------------------------------------------
   */

  function applyTemplate(templateId) {
    const template = TEMPLATES.find(function (item) {
      return item.id === templateId;
    });

    if (!template) {
      return;
    }

    state.template = template.id;
    state.foreground = template.foreground;
    state.background = template.background;

    renderPreview();
    updateUI();
  }

  function applyPreset(presetName) {
    const preset = COLOR_PRESETS.find(function (item) {
      return item.name === presetName;
    });

    if (!preset) {
      return;
    }

    state.template = "custom";
    state.foreground = preset.foreground;
    state.background = preset.background;

    renderPreview();
    updateUI();
  }

  /*
   * ------------------------------------------------------------
   * QR Rendering
   * ------------------------------------------------------------
   */

  function renderPreview() {
    const output = getOutputElement();

    if (!output) {
      return;
    }

    const payload =
      getCurrentPayload();

    if (!payload) {
      return;
    }

    /*
     * qrcodejs is loaded by script.js before the first QR is
     * created. We only render here when the global constructor
     * is available.
     */
    if (typeof window.QRCode !== "function") {
      showEditorMessage(
        "QR engine is still loading. Please try again."
      );

      return;
    }

    try {
      output.innerHTML = "";

      const qr = document.createElement("div");

      qr.className = "qrnavi-live-qr";

      output.appendChild(qr);

      new window.QRCode(qr, {
        text: payload,
        width: state.size,
        height: state.size,
        colorDark: state.foreground,
        colorLight: state.background,
        correctLevel:
          window.QRCode.CorrectLevel.M
      });

      /*
       * qrcodejs may produce either canvas or image depending
       * on browser support. We style both consistently.
       */
      requestAnimationFrame(function () {
        const canvas = qr.querySelector("canvas");
        const image = qr.querySelector("img");

        if (canvas) {
          canvas.style.display = "block";
          canvas.style.width = state.size + "px";
          canvas.style.height = state.size + "px";
          canvas.style.maxWidth = "100%";
          canvas.style.height = "auto";
        }

        if (image) {
          image.style.display = "block";
          image.style.width = state.size + "px";
          image.style.height = state.size + "px";
          image.style.maxWidth = "100%";
          image.style.height = "auto";
        }
      });

      clearEditorMessage();

    } catch (error) {
      console.error(
        "QRNAVI customizer rendering error:",
        error
      );

      showEditorMessage(
        "The QR preview could not be updated. Your original QR data is unchanged."
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * State / UI
   * ------------------------------------------------------------
   */

  function updateUI() {
    if (!customizerElement) {
      return;
    }

    const foregroundPicker =
      customizerElement.querySelector(
        "#qrnavi-foreground-picker"
      );

    const backgroundPicker =
      customizerElement.querySelector(
        "#qrnavi-background-picker"
      );

    const foregroundHex =
      customizerElement.querySelector(
        "#qrnavi-foreground-hex"
      );

    const backgroundHex =
      customizerElement.querySelector(
        "#qrnavi-background-hex"
      );

    const sizeValue =
      customizerElement.querySelector(
        "#qrnavi-size-value"
      );


    if (foregroundPicker) {
      foregroundPicker.value =
        normalizeHex(state.foreground) ||
        DEFAULTS.foreground;
    }

    if (backgroundPicker) {
      backgroundPicker.value =
        normalizeHex(state.background) ||
        DEFAULTS.background;
    }

    if (foregroundHex) {
      foregroundHex.value =
        state.foreground.toUpperCase();
    }

    if (backgroundHex) {
      backgroundHex.value =
        state.background.toUpperCase();
    }

    if (sizeValue) {
      sizeValue.textContent =
        state.size + " × " + state.size;
    }


    updateTemplateButtons();
    updateSizeButtons();
    updateContrast();
    updateSwatches();
  }

  function updateTemplateButtons() {
    const buttons =
      customizerElement.querySelectorAll(
        "[data-template]"
      );

    buttons.forEach(function (button) {
      const id =
        button.getAttribute("data-template");

      const active =
        id === state.template;

      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        active ? "true" : "false"
      );
    });
  }

  function updateSizeButtons() {
    const buttons =
      customizerElement.querySelectorAll(
        "[data-size]"
      );

    buttons.forEach(function (button) {
      const size =
        Number(
          button.getAttribute("data-size")
        );

      const active =
        size === state.size;

      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        active ? "true" : "false"
      );
    });
  }

  function updateSwatches() {
    const foregroundSwatch =
      customizerElement.querySelector(
        ".qrnavi-foreground-swatch"
      );

    const backgroundSwatch =
      customizerElement.querySelector(
        ".qrnavi-background-swatch"
      );

    if (foregroundSwatch) {
      foregroundSwatch.style.background =
        state.foreground;
    }

    if (backgroundSwatch) {
      backgroundSwatch.style.background =
        state.background;
    }
  }

  /*
   * ------------------------------------------------------------
   * Contrast / Readability
   * ------------------------------------------------------------
   */

  function updateContrast() {
    const box =
      customizerElement.querySelector(
        "#qrnavi-contrast-box"
      );

    const title =
      customizerElement.querySelector(
        "#qrnavi-contrast-title"
      );

    const message =
      customizerElement.querySelector(
        "#qrnavi-contrast-message"
      );

    const icon =
      customizerElement.querySelector(
        ".qrnavi-contrast-icon"
      );

    if (!box || !title || !message) {
      return;
    }

    const ratio = getContrastRatio(
      state.foreground,
      state.background
    );

    box.classList.remove(
      "is-good",
      "is-warning",
      "is-poor"
    );

    if (ratio >= 7) {
      box.classList.add("is-good");

      if (icon) {
        icon.textContent = "✓";
      }

      title.textContent =
        "Excellent contrast";

      message.textContent =
        "Strong contrast for reliable QR scanning.";
    } else if (ratio >= 4.5) {
      box.classList.add("is-good");

      if (icon) {
        icon.textContent = "✓";
      }

      title.textContent =
        "Good contrast";

      message.textContent =
        "These colors provide a solid readability level.";
    } else if (ratio >= 3) {
      box.classList.add("is-warning");

      if (icon) {
        icon.textContent = "!";
      }

      title.textContent =
        "Low contrast";

      message.textContent =
        "Consider using darker QR color or a lighter background.";
    } else {
      box.classList.add("is-poor");

      if (icon) {
        icon.textContent = "!";
      }

      title.textContent =
        "Poor contrast";

      message.textContent =
        "These colors may reduce scanning reliability.";
    }
  }

  function getContrastRatio(foreground, background) {
    const fg = hexToRGB(foreground);
    const bg = hexToRGB(background);

    if (!fg || !bg) {
      return 1;
    }

    const fgLuminance =
      getRelativeLuminance(fg);

    const bgLuminance =
      getRelativeLuminance(bg);

    const lighter =
      Math.max(
        fgLuminance,
        bgLuminance
      );

    const darker =
      Math.min(
        fgLuminance,
        bgLuminance
      );

    return (
      (lighter + 0.05) /
      (darker + 0.05)
    );
  }

  function getRelativeLuminance(rgb) {
    const values = [
      rgb.r,
      rgb.g,
      rgb.b
    ].map(function (value) {
      const normalized =
        value / 255;

      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow(
            (normalized + 0.055) / 1.055,
            2.4
          );
    });

    return (
      values[0] * 0.2126 +
      values[1] * 0.7152 +
      values[2] * 0.0722
    );
  }

  /*
   * ------------------------------------------------------------
   * Reset / Apply
   * ------------------------------------------------------------
   */

  function resetCustomizer() {
    state = {
      ...DEFAULTS
    };

    renderPreview();
    updateUI();

    showEditorMessage(
      "Customization reset to the QRNAVI default style."
    );
  }

  function applyCustomization() {
    const contrast =
      getContrastRatio(
        state.foreground,
        state.background
      );

    if (contrast < 3) {
      showEditorMessage(
        "Please improve the color contrast before applying this design."
      );

      return;
    }

    appliedState = {
      ...state
    };

    renderPreview();
    updateUI();

    const button =
      customizerElement.querySelector(
        "#qrnavi-apply-button"
      );

    if (button) {
      const originalHTML =
        button.innerHTML;

      button.innerHTML = `
        <span>Applied successfully</span>
        <span class="qrnavi-apply-arrow">✓</span>
      `;

      button.classList.add(
        "is-success"
      );

      window.setTimeout(function () {
        button.innerHTML =
          originalHTML;

        button.classList.remove(
          "is-success"
        );
      }, 1800);
    }

    showEditorMessage(
      "Your customized QR is ready. Your QR information has not changed."
    );

    /*
     * Expose applied state for download-system.js.
     */
    exposeState();
  }

  /*
   * ------------------------------------------------------------
   * Public State
   * ------------------------------------------------------------
   */

  function exposeState() {
    window.QRNAVI_CUSTOMIZER = {
      getState: function () {
        return {
          ...state
        };
      },

      getAppliedState: function () {
        return {
          ...appliedState
        };
      },

      getForeground: function () {
        return state.foreground;
      },

      getBackground: function () {
        return state.background;
      },

      getSize: function () {
        return state.size;
      },

      getTemplate: function () {
        return state.template;
      },

      getContrastRatio: function () {
        return getContrastRatio(
          state.foreground,
          state.background
        );
      },

      reset: resetCustomizer,

      apply: applyCustomization
    };
  }

  /*
   * ------------------------------------------------------------
   * Messages
   * ------------------------------------------------------------
   */

  function showEditorMessage(message) {
    if (!customizerElement) {
      return;
    }

    let element =
      customizerElement.querySelector(
        "#qrnavi-editor-note"
      );

    if (!element) {
      return;
    }

    element.textContent = message;
    element.classList.add(
      "is-visible"
    );

    window.clearTimeout(
      element._qrnaviMessageTimer
    );

    element._qrnaviMessageTimer =
      window.setTimeout(function () {
        element.classList.remove(
          "is-visible"
        );
      }, 4000);
  }

  function clearEditorMessage() {
    if (!customizerElement) {
      return;
    }

    const element =
      customizerElement.querySelector(
        "#qrnavi-editor-note"
      );

    if (element) {
      element.classList.remove(
        "is-visible"
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * Current QR data
   * ------------------------------------------------------------
   */

  function getCurrentPayload() {
    if (
      window.QRNAVI &&
      typeof window.QRNAVI.getCurrentPayload ===
        "function"
    ) {
      return window.QRNAVI.getCurrentPayload();
    }

    return "";
  }

  /*
   * ------------------------------------------------------------
   * HEX helpers
   * ------------------------------------------------------------
   */

  function isValidHex(value) {
    return /^#[0-9a-fA-F]{6}$/.test(
      value
    );
  }

  function normalizeHex(value) {
    if (!value) {
      return null;
    }

    let color =
      String(value).trim();

    if (
      /^[0-9a-fA-F]{6}$/.test(color)
    ) {
      color = "#" + color;
    }

    if (!isValidHex(color)) {
      return null;
    }

    return color.toUpperCase();
  }

  function hexToRGB(hex) {
    const normalized =
      normalizeHex(hex);

    if (!normalized) {
      return null;
    }

    return {
      r: parseInt(
        normalized.slice(1, 3),
        16
      ),

      g: parseInt(
        normalized.slice(3, 5),
        16
      ),

      b: parseInt(
        normalized.slice(5, 7),
        16
      )
    };
  }

  function syncColorPicker(
    type,
    color
  ) {
    if (!customizerElement) {
      return;
    }

    const id =
      type === "foreground"
        ? "#qrnavi-foreground-picker"
        : "#qrnavi-background-picker";

    const picker =
      customizerElement.querySelector(id);

    if (picker) {
      const normalized =
        normalizeHex(color);

      if (normalized) {
        picker.value =
          normalized;
      }
    }
  }

  function markInvalidInput(
    element,
    invalid
  ) {
    element.classList.toggle(
      "is-invalid",
      invalid
    );

    element.setAttribute(
      "aria-invalid",
      invalid ? "true" : "false"
    );
  }

  /*
   * ------------------------------------------------------------
   * Security helpers
   * ------------------------------------------------------------
   */

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value);
  }

  /*
   * ------------------------------------------------------------
   * Premium Customizer CSS
   *
   * This stylesheet is injected by the customizer so the
   * existing index.html does not need to be modified just to
   * display the editor.
   * ------------------------------------------------------------
   */

  function injectCustomizerStyles() {
    if (
      document.getElementById(
        "qrnavi-customizer-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "qrnavi-customizer-styles";

    style.textContent = `
      /* ======================================================
         QRNAVI PREMIUM QR EDITOR
         ====================================================== */

      #qrnavi-customizer {
        width: 100%;
        margin: 28px 0 0;
        font-family:
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      .qrnavi-customizer-shell {
        width: 100%;
        background: #ffffff;
        border: 1px solid #e5eaf1;
        border-radius: 24px;
        box-shadow:
          0 18px 55px rgba(7, 20, 38, 0.08);
        overflow: hidden;
      }

      .qrnavi-customizer-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        padding: 28px 24px;
        background:
          linear-gradient(
            135deg,
            #071426 0%,
            #0c2039 100%
          );
        color: #ffffff;
      }

      .qrnavi-editor-eyebrow {
        display: inline-block;
        margin-bottom: 8px;
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.12em;
        font-weight: 800;
        color: #8dc5ff;
      }

      .qrnavi-customizer-header h2 {
        margin: 0;
        font-size: 24px;
        line-height: 1.2;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .qrnavi-customizer-header p {
        max-width: 620px;
        margin: 9px 0 0;
        color: #b9c8da;
        font-size: 14px;
        line-height: 1.6;
      }

      .qrnavi-editor-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        flex: 0 0 auto;
        padding: 8px 11px;
        border: 1px solid rgba(255,255,255,0.13);
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        color: #dcecff;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }

      .qrnavi-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #55d98b;
        box-shadow:
          0 0 0 4px rgba(85,217,139,0.12);
      }

      .qrnavi-editor-section {
        padding: 25px 24px;
        border-bottom: 1px solid #edf0f4;
      }

      .qrnavi-section-title-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 17px;
      }

      .qrnavi-section-title-row h3 {
        margin: 0;
        color: #111827;
        font-size: 16px;
        line-height: 1.35;
        font-weight: 800;
      }

      .qrnavi-section-title-row p {
        margin: 5px 0 0;
        color: #6b7280;
        font-size: 13px;
        line-height: 1.5;
      }

      /* Templates */

      .qrnavi-template-grid {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .qrnavi-template-card {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        padding: 11px;
        border: 1px solid #e5eaf1;
        border-radius: 15px;
        background: #ffffff;
        color: #111827;
        text-align: left;
        cursor: pointer;
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease,
          transform 0.18s ease,
          background 0.18s ease;
      }

      .qrnavi-template-card:hover {
        border-color: #b8d8fa;
        box-shadow:
          0 7px 18px rgba(7, 20, 38, 0.07);
        transform: translateY(-1px);
      }

      .qrnavi-template-card.is-active {
        border-color: #2589f4;
        background: #f7fbff;
        box-shadow:
          0 0 0 3px rgba(37,137,244,0.10);
      }

      .qrnavi-template-preview {
        position: relative;
        display: grid;
        place-items: center;
        flex: 0 0 43px;
        width: 43px;
        height: 43px;
        border-radius: 10px;
        background:
          var(--template-bg);
        overflow: hidden;
      }

      .qrnavi-mini-qr {
        display: grid;
        grid-template-columns:
          repeat(3, 6px);
        grid-template-rows:
          repeat(3, 6px);
        gap: 2px;
        padding: 5px;
      }

      .qrnavi-mini-qr i {
        display: block;
        width: 6px;
        height: 6px;
        border-radius: 1px;
        background: var(--template-fg);
      }

      .qrnavi-mini-qr i:nth-child(2),
      .qrnavi-mini-qr i:nth-child(4),
      .qrnavi-mini-qr i:nth-child(6),
      .qrnavi-mini-qr i:nth-child(8) {
        opacity: 0.28;
      }

      .qrnavi-template-info {
        display: flex;
        min-width: 0;
        flex-direction: column;
      }

      .qrnavi-template-info strong {
        overflow: hidden;
        color: #172033;
        font-size: 12px;
        line-height: 1.35;
        font-weight: 800;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .qrnavi-template-info small {
        margin-top: 2px;
        overflow: hidden;
        color: #7b8492;
        font-size: 10px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .qrnavi-template-check {
        position: absolute;
        top: 7px;
        right: 7px;
        display: grid;
        place-items: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #2589f4;
        color: #ffffff;
        font-size: 9px;
        font-weight: 900;
        opacity: 0;
        transform: scale(0.75);
        transition:
          opacity 0.18s ease,
          transform 0.18s ease;
      }

      .qrnavi-template-card.is-active
      .qrnavi-template-check {
        opacity: 1;
        transform: scale(1);
      }

      /* Color */

      .qrnavi-control-label-row {
        margin-bottom: 9px;
        color: #4b5563;
        font-size: 12px;
        font-weight: 700;
      }

      .qrnavi-preset-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .qrnavi-preset-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        padding: 6px 9px;
        border: 1px solid #e5eaf1;
        border-radius: 9px;
        background: #ffffff;
        color: #4b5563;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition:
          border-color 0.18s ease,
          background 0.18s ease;
      }

      .qrnavi-preset-button:hover {
        border-color: #b8d8fa;
        background: #f8fbff;
      }

      .qrnavi-preset-preview {
        width: 16px;
        height: 16px;
        border: 1px solid rgba(7,20,38,0.10);
        border-radius: 5px;
        background:
          linear-gradient(
            135deg,
            var(--preset-fg) 0 50%,
            var(--preset-bg) 50% 100%
          );
      }

      .qrnavi-color-editor-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 17px;
      }

      .qrnavi-color-card {
        padding: 15px;
        border: 1px solid #e6ebf1;
        border-radius: 15px;
        background: #fbfcfe;
      }

      .qrnavi-color-card-heading {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-bottom: 12px;
      }

      .qrnavi-color-swatch {
        width: 30px;
        height: 30px;
        border: 1px solid #dfe5ed;
        border-radius: 9px;
        background: #071426;
      }

      .qrnavi-color-card-heading div {
        display: flex;
        flex-direction: column;
      }

      .qrnavi-color-card-heading strong {
        color: #1f2937;
        font-size: 12px;
        line-height: 1.3;
      }

      .qrnavi-color-card-heading small {
        margin-top: 2px;
        color: #8a94a3;
        font-size: 10px;
      }

      .qrnavi-color-input-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .qrnavi-color-input-row input[type="color"] {
        width: 42px;
        height: 38px;
        padding: 3px;
        border: 1px solid #dce3ec;
        border-radius: 9px;
        background: #ffffff;
        cursor: pointer;
      }

      .qrnavi-hex-input {
        width: 100%;
        min-width: 0;
        height: 38px;
        padding: 0 11px;
        border: 1px solid #dce3ec;
        border-radius: 9px;
        outline: none;
        background: #ffffff;
        color: #111827;
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 12px;
        font-weight: 700;
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease;
      }

      .qrnavi-hex-input:focus {
        border-color: #2589f4;
        box-shadow:
          0 0 0 3px rgba(37,137,244,0.10);
      }

      .qrnavi-hex-input.is-invalid {
        border-color: #dc2626;
        box-shadow:
          0 0 0 3px rgba(220,38,38,0.08);
      }

      /* Contrast */

      .qrnavi-contrast-box {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 13px;
        padding: 12px 13px;
        border: 1px solid #dce8f4;
        border-radius: 12px;
        background: #f7fbff;
      }

      .qrnavi-contrast-icon {
        display: grid;
        place-items: center;
        flex: 0 0 22px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #dbeafe;
        color: #1769aa;
        font-size: 11px;
        font-weight: 900;
      }

      .qrnavi-contrast-box strong {
        display: block;
        color: #1f3b56;
        font-size: 11px;
        line-height: 1.4;
      }

      .qrnavi-contrast-box p {
        margin: 2px 0 0;
        color: #65758a;
        font-size: 11px;
        line-height: 1.45;
      }

      .qrnavi-contrast-box.is-good {
        border-color: #cfe9dc;
        background: #f5fcf8;
      }

      .qrnavi-contrast-box.is-good
      .qrnavi-contrast-icon {
        background: #dcf5e6;
        color: #16834a;
      }

      .qrnavi-contrast-box.is-good strong {
        color: #16643e;
      }

      .qrnavi-contrast-box.is-warning {
        border-color: #f0dfb6;
        background: #fffaf0;
      }

      .qrnavi-contrast-box.is-warning
      .qrnavi-contrast-icon {
        background: #fff0c7;
        color: #9a6700;
      }

      .qrnavi-contrast-box.is-warning strong {
        color: #805900;
      }

      .qrnavi-contrast-box.is-poor {
        border-color: #f1caca;
        background: #fff7f7;
      }

      .qrnavi-contrast-box.is-poor
      .qrnavi-contrast-icon {
        background: #fee2e2;
        color: #b91c1c;
      }

      .qrnavi-contrast-box.is-poor strong {
        color: #991b1b;
      }

      /* Size */

      .qrnavi-size-value {
        flex: 0 0 auto;
        padding: 6px 9px;
        border: 1px solid #e3e9f0;
        border-radius: 8px;
        background: #f8fafc;
        color: #536174;
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 10px;
        font-weight: 800;
      }

      .qrnavi-size-grid {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 9px;
      }

      .qrnavi-size-option {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 0;
        padding: 12px;
        border: 1px solid #e5eaf1;
        border-radius: 12px;
        background: #ffffff;
        text-align: left;
        cursor: pointer;
        transition:
          border-color 0.18s ease,
          background 0.18s ease,
          box-shadow 0.18s ease;
      }

      .qrnavi-size-option:hover {
        border-color: #b8d8fa;
        background: #f9fcff;
      }

      .qrnavi-size-option.is-active {
        border-color: #2589f4;
        background: #f7fbff;
        box-shadow:
          0 0 0 3px rgba(37,137,244,0.09);
      }

      .qrnavi-size-option strong {
        color: #172033;
        font-size: 12px;
        line-height: 1.3;
      }

      .qrnavi-size-option span {
        margin-top: 3px;
        color: #7b8492;
        font-size: 10px;
      }

      .qrnavi-size-option small {
        margin-top: 7px;
        color: #2589f4;
        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;
        font-size: 10px;
        font-weight: 800;
      }

      /* Reliability */

      .qrnavi-reliability-section {
        background: #fbfcfe;
      }

      .qrnavi-reliability-card {
        display: flex;
        align-items: flex-start;
        gap: 11px;
        padding: 13px;
        border: 1px solid #e3e9f0;
        border-radius: 13px;
        background: #ffffff;
      }

      .qrnavi-reliability-icon {
        display: grid;
        place-items: center;
        flex: 0 0 28px;
        width: 28px;
        height: 28px;
        border-radius: 9px;
        background: #e7f3ff;
        color: #2589f4;
        font-size: 12px;
        font-weight: 900;
      }

      .qrnavi-reliability-card strong {
        display: block;
        color: #1f2937;
        font-size: 12px;
        line-height: 1.4;
      }

      .qrnavi-reliability-card p {
        margin: 3px 0 0;
        color: #6b7280;
        font-size: 11px;
        line-height: 1.5;
      }

      /* Actions */

      .qrnavi-editor-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 20px 24px;
      }

      .qrnavi-reset-button,
      .qrnavi-apply-button {
        min-height: 45px;
        border-radius: 11px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease,
          border-color 0.18s ease;
      }

      .qrnavi-reset-button {
        flex: 0 0 auto;
        padding: 0 17px;
        border: 1px solid #dfe5ec;
        background: #ffffff;
        color: #4b5563;
      }

      .qrnavi-reset-button:hover {
        border-color: #c8d1dc;
        background: #f8fafc;
      }

      .qrnavi-apply-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        flex: 1;
        padding: 0 18px;
        border: 1px solid #2589f4;
        background: #2589f4;
        color: #ffffff;
        box-shadow:
          0 8px 18px rgba(37,137,244,0.20);
      }

      .qrnavi-apply-button:hover {
        background: #1478df;
        transform: translateY(-1px);
        box-shadow:
          0 11px 22px rgba(37,137,244,0.24);
      }

      .qrnavi-apply-button.is-success {
        border-color: #16834a;
        background: #16834a;
        box-shadow:
          0 8px 18px rgba(22,131,74,0.18);
      }

      .qrnavi-apply-arrow {
        font-size: 17px;
        line-height: 1;
      }

      .qrnavi-editor-note {
        min-height: 0;
        padding: 0 24px;
        color: #6b7280;
        font-size: 11px;
        line-height: 1.5;
        opacity: 0;
        transform: translateY(-3px);
        transition:
          opacity 0.2s ease,
          transform 0.2s ease;
      }

      .qrnavi-editor-note.is-visible {
        padding-bottom: 19px;
        opacity: 1;
        transform: translateY(0);
      }

      /* Live QR */

      .qrnavi-live-qr {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 0;
        background: transparent;
      }

      .qrnavi-live-qr canvas,
      .qrnavi-live-qr img {
        display: block;
        max-width: 100%;
        height: auto;
      }

      /* Tablet */

      @media (max-width: 900px) {
        .qrnavi-template-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .qrnavi-size-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      /* Mobile */

      @media (max-width: 640px) {

        #qrnavi-customizer {
          margin-top: 20px;
        }

        .qrnavi-customizer-shell {
          border-radius: 18px;
        }

        .qrnavi-customizer-header {
          flex-direction: column;
          padding: 22px 17px;
        }

        .qrnavi-customizer-header h2 {
          font-size: 21px;
        }

        .qrnavi-customizer-header p {
          font-size: 12px;
        }

        .qrnavi-editor-status {
          align-self: flex-start;
        }

        .qrnavi-editor-section {
          padding: 20px 17px;
        }

        .qrnavi-template-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .qrnavi-template-card {
          padding: 9px;
        }

        .qrnavi-template-preview {
          flex-basis: 38px;
          width: 38px;
          height: 38px;
        }

        .qrnavi-template-info strong {
          font-size: 11px;
        }

        .qrnavi-template-info small {
          font-size: 9px;
        }

        .qrnavi-color-editor-grid {
          grid-template-columns: 1fr;
        }

        .qrnavi-preset-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .qrnavi-preset-button {
          justify-content: flex-start;
          width: 100%;
        }

        .qrnavi-size-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .qrnavi-editor-actions {
          padding: 17px;
        }

        .qrnavi-reset-button {
          padding: 0 14px;
        }

        .qrnavi-apply-button {
          padding: 0 13px;
        }

        .qrnavi-editor-note {
          padding-left: 17px;
          padding-right: 17px;
        }

        .qrnavi-editor-note.is-visible {
          padding-bottom: 17px;
        }
      }

      /* Very small screens */

      @media (max-width: 380px) {

        .qrnavi-template-grid {
          grid-template-columns: 1fr;
        }

        .qrnavi-color-card {
          padding: 12px;
        }

        .qrnavi-editor-actions {
          gap: 7px;
        }

        .qrnavi-reset-button {
          padding: 0 11px;
          font-size: 11px;
        }

        .qrnavi-apply-button {
          font-size: 11px;
        }
      }

      /* Reduced motion */

      @media (prefers-reduced-motion: reduce) {

        .qrnavi-template-card,
        .qrnavi-size-option,
        .qrnavi-preset-button,
        .qrnavi-reset-button,
        .qrnavi-apply-button,
        .qrnavi-editor-note,
        .qrnavi-template-check {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /*
   * ------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------
   */

  function boot() {
    init();
    exposeState();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      {
        once: true
      }
    );
  } else {
    boot();
  }

  /*
   * Re-check after the existing generator has had time to load
   * qrcodejs and create its QR.
   */
  window.setTimeout(
    init,
    350
  );

  window.setTimeout(
    init,
    1000
  );

})();
