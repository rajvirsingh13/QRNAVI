/* =========================================================
   QRNAVI — MAIN QR GENERATOR ENGINE
   Compatible with:
   index.html
   style.css
   download-system.js
   qr-customizer.js
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const QRNAVI_CONFIG = {
  libraryUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",

  size: 320,

  /*
    Quiet zone around the actual QR code.
    This is part of the generated image, not CSS.
  */
  quietZone: 16,

  foreground: "#071426",
  background: "#ffffff"
};


/* =========================================================
   DOM REFERENCES
========================================================= */

let qrType;
let qrInput;
let generateButton;
let qrOutput;
let qrInputGroup;
let wifiFields;
let generatorForm;


/* =========================================================
   STATE
========================================================= */

let qrLibraryPromise = null;
let currentQRCode = null;


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  qrType = document.getElementById("qr-type");
  qrInput = document.getElementById("qr-input");
  generateButton = document.getElementById("generate-btn");
  qrOutput = document.getElementById("qr-output");
  qrInputGroup = document.getElementById("qr-input-group");
  wifiFields = document.getElementById("wifi-fields");
  generatorForm = document.getElementById("qr-generator-form");

  if (!qrType || !generateButton || !qrOutput) {
    return;
  }

  setupGenerator();
});


/* =========================================================
   GENERATOR SETUP
========================================================= */

function setupGenerator() {

  qrType.addEventListener("change", handleQRTypeChange);

  generateButton.addEventListener("click", handleGenerateClick);

  if (generatorForm) {
    generatorForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleGenerateClick();
    });
  }

  handleQRTypeChange();

  /*
    Generate an initial QR only when there is already
    meaningful input. Otherwise keep the preview empty.
  */
  if (qrInput && qrInput.value.trim() !== "") {
    handleGenerateClick();
  }
}


/* =========================================================
   QR TYPE CHANGE
========================================================= */

function handleQRTypeChange() {

  const type = getSelectedType();

  clearMessage();

  if (type === "wifi") {
    showWiFiFields();
    hideGenericInput();
    return;
  }

  hideWiFiFields();
  showGenericInput(type);
}


/* =========================================================
   GENERIC INPUT CONTROL
========================================================= */

function showGenericInput(type) {

  if (!qrInputGroup || !qrInput) {
    return;
  }

  qrInputGroup.style.display = "flex";

  qrInput.disabled = false;

  qrInput.value = "";

  const settings = getInputSettings(type);

  qrInput.placeholder = settings.placeholder;

  qrInput.setAttribute("aria-label", settings.label);
}


function hideGenericInput() {

  if (!qrInputGroup || !qrInput) {
    return;
  }

  qrInputGroup.style.display = "none";

  qrInput.disabled = true;

  qrInput.value = "";
}


function getInputSettings(type) {

  switch (type) {

    case "url":
      return {
        label: "Website URL",
        placeholder: "https://example.com"
      };

    case "text":
      return {
        label: "Text",
        placeholder: "Enter your text"
      };

    case "email":
      return {
        label: "Email Address",
        placeholder: "name@example.com"
      };

    case "phone":
      return {
        label: "Phone Number",
        placeholder: "+91 9876543210"
      };

    case "sms":
      return {
        label: "SMS Information",
        placeholder: "Enter phone number and message"
      };

    case "vcard":
      return {
        label: "Contact Information",
        placeholder:
          "Name: Rajvir Singh\nPhone: +91 9876543210\nEmail: name@example.com"
      };

    case "whatsapp":
      return {
        label: "WhatsApp Number or Link",
        placeholder: "+91 9876543210"
      };

    case "instagram":
      return {
        label: "Instagram Profile",
        placeholder: "https://instagram.com/username"
      };

    case "location":
      return {
        label: "Location",
        placeholder: "Enter a Google Maps link or location"
      };

    default:
      return {
        label: "Information",
        placeholder: "Enter your information"
      };
  }
}


/* =========================================================
   WIFI FIELDS
========================================================= */

function showWiFiFields() {

  if (!wifiFields) {
    return;
  }

  wifiFields.innerHTML = `
    <div class="form-group">
      <label for="wifi-ssid">WiFi Network Name</label>
      <input
        type="text"
        id="wifi-ssid"
        name="wifi-ssid"
        placeholder="Enter WiFi network name"
        autocomplete="off"
      >
    </div>

    <div class="form-group">
      <label for="wifi-password">WiFi Password</label>
      <input
        type="text"
        id="wifi-password"
        name="wifi-password"
        placeholder="Enter WiFi password"
        autocomplete="off"
      >
    </div>

    <div class="form-group">
      <label for="wifi-security">Security</label>
      <select id="wifi-security" name="wifi-security">
        <option value="WPA">WPA/WPA2</option>
        <option value="WEP">WEP</option>
        <option value="nopass">No Password</option>
      </select>
    </div>

    <div class="form-group">
      <label for="wifi-hidden">Hidden Network</label>
      <select id="wifi-hidden" name="wifi-hidden">
        <option value="false">No</option>
        <option value="true">Yes</option>
      </select>
    </div>
  `;
}


function hideWiFiFields() {

  if (!wifiFields) {
    return;
  }

  wifiFields.innerHTML = "";
}


/* =========================================================
   GENERATE BUTTON
========================================================= */

async function handleGenerateClick() {

  if (!qrOutput) {
    return;
  }

  clearMessage();

  const type = getSelectedType();

  let payload;

  try {
    payload = buildPayload(type);
  } catch (error) {
    showMessage(error.message || "Please check your information.");
    return;
  }

  if (!payload) {
    showMessage("Please enter the required information.");
    return;
  }

  setGeneratingState(true);

  try {

    await loadQRCodeLibrary();

    await generateQRCode(payload);

    /*
      On mobile, automatically bring the newly generated
      QR code into the visible screen area.
    */
    scheduleMobileQRScroll();

  } catch (error) {

    console.error("QRNAVI QR generation error:", error);

    showMessage(
      "QR code could not be generated. Please try again."
    );

  } finally {

    setGeneratingState(false);
  }
}


/* =========================================================
   BUILD PAYLOAD
========================================================= */

function buildPayload(type) {

  switch (type) {

    case "url":
      return buildURLPayload();

    case "text":
      return buildTextPayload();

    case "wifi":
      return buildWiFiPayload();

    case "email":
      return buildEmailPayload();

    case "phone":
      return buildPhonePayload();

    case "sms":
      return buildSMSPayload();

    case "vcard":
      return buildVCardPayload();

    case "whatsapp":
      return buildWhatsAppPayload();

    case "instagram":
      return buildInstagramPayload();

    case "location":
      return buildLocationPayload();

    default:
      throw new Error("Unsupported QR code type.");
  }
}


/* =========================================================
   URL
========================================================= */

function buildURLPayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error("Please enter a website URL.");
  }

  let url;

  try {

    url = new URL(value);

  } catch (error) {

    throw new Error(
      "Please enter a valid website URL."
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP and HTTPS website URLs are supported."
    );
  }

  return url.href;
}


/* =========================================================
   TEXT
========================================================= */

function buildTextPayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error("Please enter some text.");
  }

  return value;
}


/* =========================================================
   WIFI
========================================================= */

function buildWiFiPayload() {

  const ssidElement = document.getElementById("wifi-ssid");
  const passwordElement = document.getElementById("wifi-password");
  const securityElement = document.getElementById("wifi-security");
  const hiddenElement = document.getElementById("wifi-hidden");

  if (
    !ssidElement ||
    !passwordElement ||
    !securityElement ||
    !hiddenElement
  ) {
    throw new Error(
      "WiFi fields are not available."
    );
  }

  const ssid = ssidElement.value.trim();
  const password = passwordElement.value;
  const security = securityElement.value;
  const hidden = hiddenElement.value === "true";

  if (!ssid) {
    throw new Error(
      "Please enter the WiFi network name."
    );
  }

  if (
    security !== "nopass" &&
    !password
  ) {
    throw new Error(
      "Please enter the WiFi password."
    );
  }

  return (
    "WIFI:" +
    "T:" + escapeWiFiValue(security) +
    ";" +
    "S:" + escapeWiFiValue(ssid) +
    ";" +
    "P:" + escapeWiFiValue(password) +
    ";" +
    "H:" + (hidden ? "true" : "false") +
    ";;"
  );
}


function escapeWiFiValue(value) {

  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/:/g, "\\:");
}


/* =========================================================
   EMAIL
========================================================= */

function buildEmailPayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error(
      "Please enter an email address."
    );
  }

  const email = value.trim();

  if (!isValidEmail(email)) {
    throw new Error(
      "Please enter a valid email address."
    );
  }

  return "mailto:" + email;
}


/* =========================================================
   PHONE
========================================================= */

function buildPhonePayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error(
      "Please enter a phone number."
    );
  }

  const phone = value.trim();

  if (!isReasonablePhoneNumber(phone)) {
    throw new Error(
      "Please enter a valid phone number."
    );
  }

  return "tel:" + phone.replace(/[^\d+]/g, "");
}


/* =========================================================
   SMS
========================================================= */

function buildSMSPayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error(
      "Please enter an SMS phone number or message."
    );
  }

  /*
    Supported simple format:
    number
    number | message
    number: message
  */

  const parts = splitSMSInput(value);

  const phone = parts.phone;
  const message = parts.message;

  if (!phone) {
    throw new Error(
      "Please enter an SMS phone number."
    );
  }

  if (!isReasonablePhoneNumber(phone)) {
    throw new Error(
      "Please enter a valid SMS phone number."
    );
  }

  let result = "SMSTO:" + phone;

  if (message) {
    result += ":" + message;
  }

  return result;
}


function splitSMSInput(value) {

  const separatorIndex = value.indexOf("|");

  if (separatorIndex !== -1) {

    return {
      phone: value.slice(0, separatorIndex).trim(),
      message: value.slice(separatorIndex + 1).trim()
    };
  }

  const colonIndex = value.indexOf(":");

  if (
    colonIndex > 0 &&
    /^\+?[\d\s().-]+$/.test(
      value.slice(0, colonIndex).trim()
    )
  ) {

    return {
      phone: value.slice(0, colonIndex).trim(),
      message: value.slice(colonIndex + 1).trim()
    };
  }

  return {
    phone: value.trim(),
    message: ""
  };
}


/* =========================================================
   VCARD
========================================================= */

function buildVCardPayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error(
      "Please enter contact information."
    );
  }

  /*
    If the user already provides a complete vCard,
    preserve it.
  */

  if (
    value.toUpperCase().includes("BEGIN:VCARD")
  ) {
    return value;
  }

  const lines = value
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error(
      "Please enter contact information."
    );
  }

  let name = "";
  let phone = "";
  let email = "";

  lines.forEach(function (line) {

    const lower = line.toLowerCase();

    if (
      lower.startsWith("name:")
    ) {
      name = line.slice(5).trim();
    }

    if (
      lower.startsWith("phone:")
    ) {
      phone = line.slice(6).trim();
    }

    if (
      lower.startsWith("email:")
    ) {
      email = line.slice(6).trim();
    }

  });

  /*
    If no labels were supplied, use the first line as name.
  */

  if (!name) {
    name = lines[0];
  }

  if (!name) {
    throw new Error(
      "Please enter at least a contact name."
    );
  }

  if (
    email &&
    !isValidEmail(email)
  ) {
    throw new Error(
      "Please enter a valid contact email."
    );
  }

  let vCard =
    "BEGIN:VCARD\n" +
    "VERSION:3.0\n" +
    "FN:" + escapeVCardValue(name) + "\n";

  if (phone) {
    vCard +=
      "TEL:" +
      escapeVCardValue(phone) +
      "\n";
  }

  if (email) {
    vCard +=
      "EMAIL:" +
      escapeVCardValue(email) +
      "\n";
  }

  vCard += "END:VCARD";

  return vCard;
}


function escapeVCardValue(value) {

  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}


/* =========================================================
   WHATSAPP
========================================================= */

function buildWhatsAppPayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error(
      "Please enter a WhatsApp number or link."
    );
  }

  /*
    If a complete WhatsApp URL is supplied,
    validate it and preserve it.
  */

  if (
    /^https?:\/\//i.test(value)
  ) {

    let url;

    try {
      url = new URL(value);
    } catch (error) {
      throw new Error(
        "Please enter a valid WhatsApp link."
      );
    }

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      throw new Error(
        "Please enter a valid WhatsApp link."
      );
    }

    return url.href;
  }

  const phone = value.replace(/[^\d]/g, "");

  if (
    phone.length < 7 ||
    phone.length > 15
  ) {
    throw new Error(
      "Please enter a valid WhatsApp number with country code."
    );
  }

  return "https://wa.me/" + phone;
}


/* =========================================================
   INSTAGRAM
========================================================= */

function buildInstagramPayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error(
      "Please enter an Instagram profile."
    );
  }

  if (
    /^https?:\/\//i.test(value)
  ) {

    let url;

    try {
      url = new URL(value);
    } catch (error) {
      throw new Error(
        "Please enter a valid Instagram URL."
      );
    }

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      throw new Error(
        "Please enter a valid Instagram URL."
      );
    }

    return url.href;
  }

  const username = value
    .replace(/^@/, "")
    .trim();

  if (
    !/^[a-zA-Z0-9._]+$/.test(username)
  ) {
    throw new Error(
      "Please enter a valid Instagram username."
    );
  }

  return "https://www.instagram.com/" + username + "/";
}


/* =========================================================
   LOCATION
========================================================= */

function buildLocationPayload() {

  const value = getGenericInput();

  if (!value) {
    throw new Error(
      "Please enter a location or map link."
    );
  }

  /*
    Google Maps / other HTTP(S) links are preserved.
  */

  if (
    /^https?:\/\//i.test(value)
  ) {

    let url;

    try {
      url = new URL(value);
    } catch (error) {
      throw new Error(
        "Please enter a valid map URL."
      );
    }

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      throw new Error(
        "Please enter a valid map URL."
      );
    }

    return url.href;
  }

  /*
    Simple latitude,longitude support.
  */

  const coordinates = value.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
  );

  if (coordinates) {

    const latitude = Number(coordinates[1]);
    const longitude = Number(coordinates[2]);

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error(
        "Please enter valid coordinates."
      );
    }

    return (
      "geo:" +
      latitude +
      "," +
      longitude
    );
  }

  /*
    For normal place/address text, create a Google Maps
    search URL.
  */

  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(value)
  );
}


/* =========================================================
   QR LIBRARY LOADER
========================================================= */

function loadQRCodeLibrary() {

  if (
    typeof QRCode !== "undefined"
  ) {
    return Promise.resolve();
  }

  if (qrLibraryPromise) {
    return qrLibraryPromise;
  }

  qrLibraryPromise = new Promise(function (resolve, reject) {

    const existingScript =
      document.querySelector(
        'script[data-qrnavi-qrcode-library="true"]'
      );

    if (existingScript) {

      existingScript.addEventListener(
        "load",
        function () {
          if (typeof QRCode !== "undefined") {
            resolve();
          } else {
            reject(
              new Error(
                "QR library loaded incorrectly."
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
              "QR library could not be loaded."
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
      QRNAVI_CONFIG.libraryUrl;

    script.async = true;

    script.dataset.qrnaviQrcodeLibrary =
      "true";

    script.onload = function () {

      if (
        typeof QRCode !== "undefined"
      ) {
        resolve();
      } else {
        reject(
          new Error(
            "QR library is unavailable."
          )
        );
      }

    };

    script.onerror = function () {

      reject(
        new Error(
          "QR library could not be loaded."
        )
      );

    };

    document.head.appendChild(script);
  });

  return qrLibraryPromise;
}


/* =========================================================
   GENERATE QR CODE
========================================================= */

function generateQRCode(payload) {

  if (
    typeof QRCode === "undefined"
  ) {
    throw new Error(
      "QR library is unavailable."
    );
  }

  if (!qrOutput) {
    return Promise.resolve();
  }

  /*
    Keep the final QR output clean.
  */
  qrOutput.innerHTML = "";

  /*
    Create the QR slightly smaller than the final canvas.
    The remaining space becomes the required white quiet zone.
  */
  const quietZone = QRNAVI_CONFIG.quietZone;

  const innerSize =
    QRNAVI_CONFIG.size - (quietZone * 2);

  /*
    Temporary container used only for qrcodejs rendering.
  */
  const temporaryContainer =
    document.createElement("div");

  temporaryContainer.style.position =
    "absolute";

  temporaryContainer.style.left =
    "-10000px";

  temporaryContainer.style.top =
    "0";

  temporaryContainer.style.width =
    innerSize + "px";

  temporaryContainer.style.height =
    innerSize + "px";

  temporaryContainer.style.background =
    QRNAVI_CONFIG.background;

  temporaryContainer.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.appendChild(
    temporaryContainer
  );

  /*
    Generate the actual QR modules.
  */
  currentQRCode = new QRCode(
    temporaryContainer,
    {
      text: payload,

      width: innerSize,
      height: innerSize,

      colorDark:
        QRNAVI_CONFIG.foreground,

      colorLight:
        QRNAVI_CONFIG.background,

      correctLevel:
        QRCode.CorrectLevel.M
    }
  );

  /*
    qrcodejs normally creates a canvas and/or image.
    Wait one frame so the rendered QR is available.
  */
  return new Promise(function (resolve, reject) {

    requestAnimationFrame(function () {

      try {

        const sourceCanvas =
          temporaryContainer.querySelector(
            "canvas"
          );

        const sourceImage =
          temporaryContainer.querySelector(
            "img"
          );

        if (!sourceCanvas && !sourceImage) {
          throw new Error(
            "QR image was not rendered."
          );
        }

        /*
          Final canvas:
          320 x 320
          with 16px white quiet zone on all sides.
        */
        const finalCanvas =
          document.createElement("canvas");

        finalCanvas.width =
          QRNAVI_CONFIG.size;

        finalCanvas.height =
          QRNAVI_CONFIG.size;

        finalCanvas.setAttribute(
          "aria-label",
          "Generated QR code"
        );

        finalCanvas.style.display =
          "block";

        finalCanvas.style.width =
          QRNAVI_CONFIG.size + "px";

        finalCanvas.style.height =
          QRNAVI_CONFIG.size + "px";

        const context =
          finalCanvas.getContext("2d");

        if (!context) {
          throw new Error(
            "QR canvas could not be created."
          );
        }

        /*
          Fill the complete image with the selected
          QR background color.
        */
        context.fillStyle =
          QRNAVI_CONFIG.background;

        context.fillRect(
          0,
          0,
          QRNAVI_CONFIG.size,
          QRNAVI_CONFIG.size
        );

        /*
          Draw the actual QR inside the quiet zone.
        */
        if (sourceCanvas) {

          context.drawImage(
            sourceCanvas,
            quietZone,
            quietZone,
            innerSize,
            innerSize
          );

        } else if (sourceImage) {

          context.drawImage(
            sourceImage,
            quietZone,
            quietZone,
            innerSize,
            innerSize
          );

        } else {

          throw new Error(
            "QR image source is unavailable."
          );
        }

        /*
          Replace qrcodejs output with the final,
          properly padded canvas.
        */
        qrOutput.innerHTML = "";

        qrOutput.appendChild(
          finalCanvas
        );

        /*
          Keep currentQRCode available for the public API.
        */
        currentQRCode = {
          payload: payload,
          canvas: finalCanvas,
          size: QRNAVI_CONFIG.size,
          quietZone: quietZone
        };

        /*
          Remove temporary rendering container.
        */
        temporaryContainer.remove();

        /*
          Make sure the QR output is visible.
        */
        qrOutput.hidden = false;
        qrOutput.style.display = "flex";
        qrOutput.style.justifyContent = "center";
        qrOutput.style.alignItems = "center";

        resolve();

      } catch (error) {

        temporaryContainer.remove();

        reject(error);
      }

    });
  });
}


/* =========================================================
   MOBILE QR AUTO SCROLL
========================================================= */

function scheduleMobileQRScroll() {

  /*
    Only use this behavior on mobile-sized screens.
    Desktop layout should remain where the user generated it.
  */
  if (
    !window.matchMedia ||
    !window.matchMedia("(max-width: 899px)").matches
  ) {
    return;
  }

  /*
    Wait until the browser has painted the final QR.
  */
  requestAnimationFrame(function () {

    setTimeout(function () {

      if (!qrOutput) {
        return;
      }

      /*
        Make sure the final QR actually exists before
        attempting to scroll.
      */
      const generatedCanvas =
        qrOutput.querySelector("canvas");

      if (!generatedCanvas) {
        return;
      }

      /*
        Centering the QR in the viewport makes it clear
        that generation has completed and keeps the
        complete QR visible on normal phone screens.
      */
      try {

        qrOutput.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest"
        });

      } catch (error) {

        /*
          Fallback for older browsers.
        */
        qrOutput.scrollIntoView();
      }

    }, 100);

  });
}


/* =========================================================
   INPUT HELPERS
========================================================= */

function getSelectedType() {

  if (!qrType) {
    return "url";
  }

  return String(
    qrType.value || "url"
  ).toLowerCase();
}


function getGenericInput() {

  if (!qrInput) {
    return "";
  }

  return qrInput.value.trim();
}


/* =========================================================
   VALIDATION HELPERS
========================================================= */

function isValidEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}


function isReasonablePhoneNumber(phone) {

  const digits =
    String(phone).replace(/\D/g, "");

  return (
    digits.length >= 7 &&
    digits.length <= 15
  );
}


/* =========================================================
   UI STATE
========================================================= */

function setGeneratingState(isGenerating) {

  if (!generateButton) {
    return;
  }

  if (isGenerating) {

    generateButton.disabled = true;

    generateButton.dataset.originalText =
      generateButton.textContent;

    generateButton.textContent =
      "Generating...";

  } else {

    generateButton.disabled = false;

    if (
      generateButton.dataset.originalText
    ) {
      generateButton.textContent =
        generateButton.dataset.originalText;
    }
  }
}


/* =========================================================
   ERROR / STATUS MESSAGE
========================================================= */

function showMessage(message) {

  clearMessage();

  if (!qrOutput) {
    return;
  }

  const messageElement =
    document.createElement("p");

  messageElement.className =
    "qrnavi-message";

  messageElement.setAttribute(
    "role",
    "alert"
  );

  messageElement.textContent =
    message;

  messageElement.style.margin =
    "12px 0 0";

  messageElement.style.color =
    "#c62828";

  messageElement.style.fontSize =
    "0.9rem";

  messageElement.style.fontWeight =
    "600";

  qrOutput.parentElement.appendChild(
    messageElement
  );
}


function clearMessage() {

  const existingMessage =
    document.querySelector(
      ".qrnavi-message"
    );

  if (existingMessage) {
    existingMessage.remove();
  }
}


/* =========================================================
   PUBLIC API
   Useful for future customizer/download modules.
========================================================= */

window.QRNAVI = {
  getCurrentQRCode: function () {
    return currentQRCode;
  },

  getQRCodeOutput: function () {
    return qrOutput;
  },

  getSelectedType: function () {
    return getSelectedType();
  },

  getCurrentPayload: function () {

    try {
      return buildPayload(
        getSelectedType()
      );
    } catch (error) {
      return null;
    }
  },

  generate: function () {
    return handleGenerateClick();
  }
};
