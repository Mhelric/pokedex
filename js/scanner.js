// ==========================================
// CAMERA POKÉDEX SCANNER MODULE (GOOGLE LENS VIA SERPAPI)
// ==========================================

import { fetchPokemon } from "./api.js";

let mediaStream = null;

export async function checkScannerAvailability() {
  const scanBtn = document.getElementById("nav-scan-btn");
  try {
    const res = await fetch("/api/scan", { method: "HEAD" });
    if (res.status === 404 && scanBtn) {
      scanBtn.style.display = "none";
    }
  } catch {
    // If running purely offline or without backend, fail gracefully
  }
}

export async function startCameraStream(videoElement, statusElement) {
  stopCameraStream();

  const scannerModal = document.getElementById("scanner-modal");
  if (!scannerModal || scannerModal.classList.contains("hidden")) {
    return;
  }

  try {
    statusElement.textContent = "Requesting camera access...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });

    // Check if modal was closed while user prompt was active
    if (!scannerModal || scannerModal.classList.contains("hidden")) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    mediaStream = stream;
    videoElement.srcObject = mediaStream;
    await videoElement.play();
    statusElement.textContent = "Point camera at any Pokémon photo, card, or plushie and tap Scan!";
  } catch (error) {
    console.error("Camera access error:", error);
    statusElement.textContent = "⚠️ Camera unavailable. Upload an image file below.";
  }
}

export function stopCameraStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

/**
 * Resizes an image or video frame to a max dimension of 800px at ~0.7 JPEG quality.
 */
function downscaleCanvasToDataUrl(source, naturalWidth, naturalHeight, maxDim = 800, quality = 0.7) {
  const canvas = document.createElement("canvas");
  let width = naturalWidth;
  let height = naturalHeight;

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function classifyWithGoogleLens(base64Image, statusElement) {
  const scanBtn = document.getElementById("capture-scan-btn");
  if (scanBtn) scanBtn.disabled = true;

  statusElement.textContent = "🔍 Reverse searching with Google Lens...";

  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error ${response.status}`);
    }

    const data = await response.json();
    const pokemonName = data.pokemon;

    if (!pokemonName || pokemonName === "none") {
      statusElement.textContent = "❓ No Pokémon detected. Center the target and try again!";
      return null;
    }

    statusElement.textContent = `🎯 Identified: ${pokemonName.toUpperCase()}! Fetching Dex Entry...`;
    return await fetchPokemon(pokemonName);
  } catch (err) {
    console.error("Scanner Error:", err);
    statusElement.textContent = `❌ Scan failed: ${err.message}`;
    return null;
  } finally {
    if (scanBtn) scanBtn.disabled = false;
  }
}

export async function captureAndScanFrame(videoElement, canvasElement, statusElement) {
  if (!videoElement || !videoElement.videoWidth) {
    statusElement.textContent = "⚠️ Camera feed not ready.";
    return null;
  }

  const downscaledBase64 = downscaleCanvasToDataUrl(
    videoElement,
    videoElement.videoWidth,
    videoElement.videoHeight,
    800,
    0.7
  );

  return await classifyWithGoogleLens(downscaledBase64, statusElement);
}

export async function scanUploadedFile(fileObject, statusElement) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const downscaledBase64 = downscaleCanvasToDataUrl(img, img.naturalWidth, img.naturalHeight, 800, 0.7);
        const scannedPokemon = await classifyWithGoogleLens(downscaledBase64, statusElement);
        resolve(scannedPokemon);
      };
      img.onerror = () => {
        statusElement.textContent = "⚠️ Failed to process image file.";
        resolve(null);
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      statusElement.textContent = "⚠️ Failed to read uploaded file.";
      resolve(null);
    };
    reader.readAsDataURL(fileObject);
  });
}