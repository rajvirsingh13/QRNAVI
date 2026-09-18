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

  /*
    Final downloaded/displayed QR image size.
  */
  size: 320,

  /*
    Real white quiet zone around the QR code.

    The quiet zone is included inside the final PNG.
    It is NOT just CSS spacing.

    48px gives a reliable visible margin around
    the QR modules on the final 320px image.
  */
  quietZone: 48,

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

  qrType.addEventListener(
    "change",
    handleQRTypeChange
  );

  generateButton.addEventListener(
    "click",
    handleGenerateClick
  );

  if (generatorForm) {

    generatorForm.addEventListener(
      "submit",
      function (event) {

        event.preventDefault();

        handleGenerateClick();
      }
    );
  }

  handleQRTypeChange();

  /*
    Generate an initial QR only when there is already
    meaningful input. Otherwise keep the preview empty.
  */
  if (
    qrInput &&
    qrInput.value.trim() !== ""
  ) {

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

  qrInput.placeholder =
    settings.placeholder;

  qrInput.setAttribute(
    "aria-label",
    settings.label
  );
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
        placeholder:
          "Enter phone number and message"
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
        placeholder:
          "+91 9876543210"
      };

    case "instagram":
      return {
        label: "Instagram Profile",
        placeholder:
          "https://instagram.com/username"
      };

    case "location":
      return {
        label: "Location",
        placeholder:
          "Enter a Google Maps link or location"
      };

    default:
      return {
        label: "Information",
        placeholder:
          "Enter your information"
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
      <select
        id="wifi-security"
        name="wifi-security"
      >
        <option value="WPA">
          WPA/WPA2
        </option>

        <option value="WEP">
          WEP
        </option>

        <option value="nopass">
          No Password
        </option>
      </select>
    </div>

    <div class="form-group">
      <label for="wifi-hidden">
        Hidden Network
      </label>

      <select
        id="wifi-hidden"
        name="wifi-hidden"
      >
        <option value="false">
          No
        </option>

        <option value="true">
          Yes
        </option>
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

    showMessage(
      error.message ||
      "Please check your information."
    );

    return;
  }

  if (!payload) {

    showMessage(
      "Please enter the required information."
    );

    return;
  }

  setGeneratingState(true);

  try {

    /*
      Load QR library first.
    */
    await loadQRCodeLibrary();

    /*
      Generate and completely finish the final canvas
      before doing anything else.
    */
    await generateQRCode(payload);

    /*
      Wait for the browser to paint the QR.
      Then move the user's screen to the generated QR.
    */
    await waitForQRPaint();

    scheduleMobileQRScroll();

  } catch (error) {

    console.error(
      "QRNAVI QR generation error:",
      error
    );

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
      throw new Error(
        "Unsupported QR code type."
      );
  }
}


/* =========================================================
   URL
========================================================= */

function buildURLPayload() {

  const value = getGenericInput();

  if (!value) {

    throw new Error(
      "Please enter a website URL."
    );
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

    throw new Error(
      "Please enter some text."
    );
  }

  return value;
}


/* =========================================================
   WIFI
========================================================= */

function buildWiFiPayload() {

  const ssidElement =
    document.getElementById("wifi-ssid");

  const passwordElement =
    document.getElementById("wifi-password");

  const securityElement =
    document.getElementById("wifi-security");

  const hiddenElement =
    document.getElementById("wifi-hidden");

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

  const ssid =
    ssidElement.value.trim();

  const password =
    passwordElement.value;

  const security =
    securityElement.value;

  const hidden =
    hiddenElement.value === "true";

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
    "T:" +
    escapeWiFiValue(security) +
    ";" +
    "S:" +
    escapeWiFiValue(ssid) +
    ";" +
    "P:" +
    escapeWiFiValue(password) +
    ";" +
    "H:" +
    (hidden ? "true" : "false") +
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

  const value =
    getGenericInput();

  if (!value) {

    throw new Error(
      "Please enter an email address."
    );
  }

  const email =
    value.trim();

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

  const value =
    getGenericInput();

  if (!value) {

    throw new Error(
      "Please enter a phone number."
    );
  }

  const phone =
    value.trim();

  if (!isReasonablePhoneNumber(phone)) {

    throw new Error(
      "Please enter a valid phone number."
    );
  }

  return (
    "tel:" +
    phone.replace(/[^\d+]/g, "")
  );
}


/* =========================================================
   SMS
========================================================= */

function buildSMSPayload() {

  const value =
    getGenericInput();

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

  const parts =
    splitSMSInput(value);

  const phone =
    parts.phone;

  const message =
    parts.message;

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

  let result =
    "SMSTO:" + phone;

  if (message) {

    result +=
      ":" + message;
  }

  return result;
}


function splitSMSInput(value) {

  const separatorIndex =
    value.indexOf("|");

  if (separatorIndex !== -1) {

    return {
      phone:
        value
          .slice(0, separatorIndex)
          .trim(),

      message:
        value
          .slice(separatorIndex + 1)
          .trim()
    };
  }

  const colonIndex =
    value.indexOf(":");

  if (
    colonIndex > 0 &&
    /^\+?[\d\s().-]+$/.test(
      value
        .slice(0, colonIndex)
        .trim()
    )
  ) {

    return {
      phone:
        value
          .slice(0, colonIndex)
          .trim(),

      message:
        value
          .slice(colonIndex + 1)
          .trim()
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

  const value =
    getGenericInput();

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
    value
      .toUpperCase()
      .includes("BEGIN:VCARD")
  ) {

    return value;
  }

  const lines =
    value
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

    const lower =
      line.toLowerCase();

    if (
      lower.startsWith("name:")
    ) {

      name =
        line
          .slice(5)
          .trim();
    }

    if (
      lower.startsWith("phone:")
    ) {

      phone =
        line
          .slice(6)
          .trim();
    }

    if (
      lower.startsWith("email:")
    ) {

      email =
        line
          .slice(6)
          .trim();
    }

  });

  /*
    If no labels were supplied,
    use the first line as name.
  */

  if (!name) {

    name =
      lines[0];
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
    "FN:" +
    escapeVCardValue(name) +
    "\n";

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

  vCard +=
    "END:VCARD";

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

  const value =
    getGenericInput();

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

      url =
        new URL(value);

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

  const phone =
    value.replace(/[^\d]/g, "");

  if (
    phone.length < 7 ||
    phone.length > 15
  ) {

    throw new Error(
      "Please enter a valid WhatsApp number with country code."
    );
  }

  return (
    "https://wa.me/" +
    phone
  );
}


/* =========================================================
   INSTAGRAM
========================================================= */

function buildInstagramPayload() {

  const value =
    getGenericInput();

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

      url =
        new URL(value);

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

  const username =
    value
      .replace(/^@/, "")
      .trim();

  if (
    !/^[a-zA-Z0-9._]+$/.test(username)
  ) {

    throw new Error(
      "Please enter a valid Instagram username."
    );
  }

  return (
    "https://www.instagram.com/" +
    username +
    "/"
  );
}


/* =========================================================
   LOCATION
========================================================= */

function buildLocationPayload() {

  const value =
    getGenericInput();

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

      url =
        new URL(value);

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

  const coordinates =
    value.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
    );

  if (coordinates) {

    const latitude =
      Number(coordinates[1]);

    const longitude =
      Number(coordinates[2]);

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
    For normal place/address text,
    create a Google Maps search URL.
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

  qrLibraryPromise =
    new Promise(function (
      resolve,
      reject
    ) {

      const existingScript =
        document.querySelector(
          'script[data-qrnavi-qrcode-library="true"]'
        );

      if (existingScript) {

        /*
          The script may already be loading.
        */

        if (
          typeof QRCode !== "undefined"
        ) {

          resolve();

          return;
        }

        existingScript.addEventListener(
          "load",
          function () {

            if (
              typeof QRCode !== "undefined"
            ) {

              resolve();

            } else {

              reject(
                new Error(
                  "QR library loaded incorrectly."
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
                "QR library could not be loaded."
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
        document.createElement("script");

      script.src =
        QRNAVI_CONFIG.libraryUrl;

      script.async = true;

      script.dataset.qrnaviQrcodeLibrary =
        "true";

      script.onload =
        function () {

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

      script.onerror =
        function () {

          reject(
            new Error(
              "QR library could not be loaded."
            )
          );

        };

      document.head.appendChild(
        script
      );
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

    return Promise.reject(
      new Error(
        "QR library is unavailable."
      )
    );
  }

  if (!qrOutput) {

    return Promise.resolve();
  }

  /*
    Remove previous QR.
  */
  qrOutput.innerHTML = "";

  /*
    Calculate the actual QR drawing area.

    Final image:
    320px

    Quiet zone:
    48px left
    48px right
    48px top
    48px bottom

    Actual QR:
    224px x 224px
  */
  const finalSize =
    QRNAVI_CONFIG.size;

  const quietZone =
    QRNAVI_CONFIG.quietZone;

  const innerSize =
    finalSize -
    (quietZone * 2);

  if (innerSize <= 0) {

    return Promise.reject(
      new Error(
        "Invalid QR size configuration."
      )
    );
  }

  /*
    Temporary off-screen container.

    qrcodejs generates the QR here.
    It is never shown to the user.
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

  temporaryContainer.style.overflow =
    "hidden";

  temporaryContainer.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.appendChild(
    temporaryContainer
  );

  /*
    Generate QR modules.
  */
  try {

    new QRCode(
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

  } catch (error) {

    temporaryContainer.remove();

    return Promise.reject(error);
  }

  /*
    Wait for qrcodejs to place its canvas/image.
  */
  return waitForQRCodeSource(
    temporaryContainer
  )
    .then(function (source) {

      /*
        Create the FINAL PNG canvas.
        This is the canvas that the user sees
        and the download system downloads.
      */
      const finalCanvas =
        document.createElement("canvas");

      finalCanvas.width =
        finalSize;

      finalCanvas.height =
        finalSize;

      finalCanvas.setAttribute(
        "aria-label",
        "Generated QR code"
      );

      finalCanvas.setAttribute(
        "role",
        "img"
      );

      finalCanvas.style.display =
        "block";

      finalCanvas.style.width =
        finalSize + "px";

      finalCanvas.style.height =
        finalSize + "px";

      const context =
        finalCanvas.getContext(
          "2d"
        );

      if (!context) {

        throw new Error(
          "QR canvas could not be created."
        );
      }

      /*
        IMPORTANT:

        Disable image smoothing so that QR modules
        stay sharp when the 224px source is placed
        inside the final 320px image.
      */
      context.imageSmoothingEnabled =
        false;

      /*
        Fill the complete final image
        with the QR background.
      */
      context.fillStyle =
        QRNAVI_CONFIG.background;

      context.fillRect(
        0,
        0,
        finalSize,
        finalSize
      );

      /*
        Draw actual QR inside the white quiet zone.
      */
      context.drawImage(
        source,
        quietZone,
        quietZone,
        innerSize,
        innerSize
      );

      /*
        Clean up temporary qrcodejs output.
      */
      temporaryContainer.remove();

      /*
        Put ONLY the final canvas into qr-output.
      */
      qrOutput.innerHTML = "";

      qrOutput.appendChild(
        finalCanvas
      );

      /*
        Store a stable QR object for other modules.
      */
      currentQRCode = {
        payload: payload,

        canvas: finalCanvas,

        size: finalSize,

        quietZone: quietZone
      };

      /*
        Make QR output visible.
      */
      qrOutput.hidden =
        false;

      qrOutput.style.display =
        "flex";

      qrOutput.style.justifyContent =
        "center";

      qrOutput.style.alignItems =
        "center";

      qrOutput.style.overflow =
        "visible";

      /*
        Return the final canvas so the caller knows
        generation is completely finished.
      */
      return finalCanvas;

    })
    .catch(function (error) {

      /*
        Always remove temporary rendering element
        if anything goes wrong.
      */
      if (
        temporaryContainer &&
        temporaryContainer.parentNode
      ) {

        temporaryContainer.remove();
      }

      throw error;
    });
}


/* =========================================================
   WAIT FOR QR SOURCE
========================================================= */

function waitForQRCodeSource(
  container
) {

  return new Promise(
    function (
      resolve,
      reject
    ) {

      const startTime =
        Date.now();

      const timeout =
        3000;

      function check() {

        const canvas =
          container.querySelector(
            "canvas"
          );

        const image =
          container.querySelector(
            "img"
          );

        if (canvas) {

          resolve(canvas);

          return;
        }

        if (
          image &&
          image.complete &&
          image.naturalWidth > 0
        ) {

          resolve(image);

          return;
        }

        if (
          Date.now() -
            startTime >=
          timeout
        ) {

          reject(
            new Error(
              "QR image was not rendered."
            )
          );

          return;
        }

        requestAnimationFrame(
          check
        );
      }

      check();
    }
  );
}


/* =========================================================
   WAIT FOR FINAL QR PAINT
========================================================= */

function waitForQRPaint() {

  return new Promise(
    function (resolve) {

      /*
        First browser paint.
      */
      requestAnimationFrame(
        function () {

          /*
            Second paint gives the browser time
            to calculate the final layout.
          */
          requestAnimationFrame(
            function () {

              resolve();

            }
          );
        }
      );
    }
  );
}


/* =========================================================
   MOBILE QR AUTO SCROLL
========================================================= */

function scheduleMobileQRScroll() {

  /*
    Only activate automatic scrolling on mobile-sized
    screens.

    Desktop remains exactly where the user generated QR.
  */
  if (
    !window.matchMedia ||
    !window.matchMedia(
      "(max-width: 899px)"
    ).matches
  ) {

    return;
  }

  /*
    Give the browser one additional paint cycle
    before calculating the exact QR position.
  */
  requestAnimationFrame(
    function () {

      setTimeout(
        function () {

          if (!qrOutput) {
            return;
          }

          const generatedCanvas =
            qrOutput.querySelector(
              "canvas"
            );

          if (!generatedCanvas) {
            return;
          }

          scrollToGeneratedQR(
            generatedCanvas
          );

        },
        120
      );
    }
  );
}


/* =========================================================
   EXACT MOBILE QR SCROLL
========================================================= */

function scrollToGeneratedQR(
  canvas
) {

  /*
    Get current QR position relative to viewport.
  */
  const rect =
    canvas.getBoundingClientRect();

  /*
    Detect sticky/fixed header height.
    This prevents the header from covering the QR.
  */
  const header =
    document.querySelector(
      ".site-header, header"
    );

  let headerHeight = 0;

  if (header) {

    const headerRect =
      header.getBoundingClientRect();

    if (
      headerRect.height >
      0
    ) {

      headerHeight =
        headerRect.height;
    }
  }

  /*
    Keep some comfortable space below the header.
  */
  const topSpacing =
    Math.max(
      headerHeight + 20,
      90
    );

  /*
    Current absolute document position of QR.
  */
  const currentTop =
    window.scrollY +
    rect.top;

  /*
    Desired position:
    QR starts below the header instead of
    remaining at the bottom of the screen.
  */
  let targetScroll =
    currentTop -
    topSpacing;

  /*
    Prevent negative scroll.
  */
  targetScroll =
    Math.max(
      0,
      targetScroll
    );

  /*
    Calculate available viewport height.

    This is used to make sure the complete QR
    can fit on normal phone screens.
  */
  const viewportHeight =
    window.innerHeight;

  const qrHeight =
    rect.height;

  /*
    If QR would still extend below the viewport,
    move it slightly higher.
  */
  const bottomPadding =
    24;

  const maximumQRBottom =
    viewportHeight -
    bottomPadding;

  const projectedQRBottom =
    topSpacing +
    qrHeight;

  if (
    projectedQRBottom >
    maximumQRBottom
  ) {

    const extraShift =
      projectedQRBottom -
      maximumQRBottom;

    targetScroll +=
      extraShift;
  }

  /*
    Final smooth scroll.
  */
  try {

    window.scrollTo(
      {
        top: targetScroll,
        behavior: "smooth"
      }
    );

  } catch (error) {

    /*
      Older browser fallback.
    */
    window.scrollTo(
      0,
      targetScroll
    );
  }
}


/* =========================================================
   INPUT HELPERS
========================================================= */

function getSelectedType() {

  if (!qrType) {
    return "url";
  }

  return String(
    qrType.value ||
    "url"
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


function isReasonablePhoneNumber(
  phone
) {

  const digits =
    String(phone).replace(
      /\D/g,
      ""
    );

  return (
    digits.length >= 7 &&
    digits.length <= 15
  );
}


/* =========================================================
   UI STATE
========================================================= */

function setGeneratingState(
  isGenerating
) {

  if (!generateButton) {
    return;
  }

  if (isGenerating) {

    generateButton.disabled =
      true;

    generateButton.dataset.originalText =
      generateButton.textContent;

    generateButton.textContent =
      "Generating...";

  } else {

    generateButton.disabled =
      false;

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

function showMessage(
  message
) {

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

  if (
    qrOutput.parentElement
  ) {

    qrOutput.parentElement.appendChild(
      messageElement
    );
  }
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

  getCurrentQRCode:
    function () {

      return currentQRCode;
    },

  getQRCodeOutput:
    function () {

      return qrOutput;
    },

  getSelectedType:
    function () {

      return getSelectedType();
    },

  getCurrentPayload:
    function () {

      try {

        return buildPayload(
          getSelectedType()
        );

      } catch (error) {

        return null;
      }
    },

  generate:
    function () {

      return handleGenerateClick();
    }
};
