// ==========================================
// CAMERA POKÉDEX SCANNER MODULE (GEMINI VISION AI)
// Vision AI Scanner powered by Gemini 1.5 Flash
// ==========================================

import { fetchPokemon } from "./api.js";

let mediaStream = null;

/**
 * Requests device camera permission and streams video feed to the <video> element.
 */
export async function startCameraStream(videoElement, statusElement) {
  try {
    statusElement.textContent = "Requesting camera access...";
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    videoElement.srcObject = mediaStream;
    await videoElement.play();
    statusElement.textContent = "Point camera at any Pokémon photo, card, or plushie and tap Scan!";
  } catch (error) {
    console.error("Camera access error:", error);
    statusElement.textContent = "⚠️ Camera unavailable. Upload an image file below.";
  }
}

/**
 * Stops all active video tracks to release camera hardware.
 */
export function stopCameraStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

/**
 * Sends base64 image string to Gemini Vision backend endpoint.
 */
async function classifyWithGeminiVision(base64Image, statusElement) {
  statusElement.textContent = "✨ Gemini Multimodal AI analyzing visual features...";

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
      statusElement.textContent = "❓ No Pokémon detected in image. Center the target and try again!";
      return null;
    }

    statusElement.textContent = `🎯 Identified: ${pokemonName.toUpperCase()}! Fetching Dex Entry...`;

    // Fetch complete Pokédex entry from PokéAPI
    return await fetchPokemon(pokemonName);
  } catch (err) {
    console.error("Gemini Vision Scan Error:", err);
    statusElement.textContent = `❌ Scan failed: ${err.message}`;
    return null;
  }
}

/**
 * Captures current camera video frame as Base64 JPEG and runs Gemini Vision AI.
 */
export async function captureAndScanFrame(videoElement, canvasElement, statusElement) {
  if (!videoElement || !videoElement.videoWidth) {
    statusElement.textContent = "⚠️ Camera feed not ready.";
    return null;
  }

  // Render video frame onto canvas
  const context = canvasElement.getContext("2d");
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  // Convert canvas to Base64 JPEG
  const base64Image = canvasElement.toDataURL("image/jpeg", 0.85);
  return await classifyWithGeminiVision(base64Image, statusElement);
}

/**
 * Converts an uploaded File object to Base64 and runs Gemini Vision AI.
 */
export async function scanUploadedFile(fileObject, statusElement) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result;
      const scannedPokemon = await classifyWithGeminiVision(base64Image, statusElement);
      resolve(scannedPokemon);
    };
    reader.onerror = () => {
      statusElement.textContent = "⚠️ Failed to read uploaded file.";
      resolve(null);
    };
    reader.readAsDataURL(fileObject);
  });
}