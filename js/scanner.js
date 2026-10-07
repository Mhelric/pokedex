// ==========================================
// CAMERA POKÉDEX SCANNER MODULE (GOOGLE LENS VIA SERPAPI)
// ==========================================

import { fetchPokemon } from "./api.js";

let mediaStream = null;

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

export function stopCameraStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

async function classifyWithGoogleLens(base64Image, statusElement) {
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
  }
}

export async function captureAndScanFrame(videoElement, canvasElement, statusElement) {
  if (!videoElement || !videoElement.videoWidth) {
    statusElement.textContent = "⚠️ Camera feed not ready.";
    return null;
  }

  const context = canvasElement.getContext("2d");
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  const base64Image = canvasElement.toDataURL("image/jpeg", 0.85);
  return await classifyWithGoogleLens(base64Image, statusElement);
}

export async function scanUploadedFile(fileObject, statusElement) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result;
      const scannedPokemon = await classifyWithGoogleLens(base64Image, statusElement);
      resolve(scannedPokemon);
    };
    reader.onerror = () => {
      statusElement.textContent = "⚠️ Failed to read uploaded file.";
      resolve(null);
    };
    reader.readAsDataURL(fileObject);
  });
}