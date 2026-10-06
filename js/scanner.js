// ==========================================
// CAMERA POKÉDEX SCANNER MODULE
// Manages device camera stream and scan capture
// ==========================================

import { fetchPokemon } from "./api.js";
import { renderPokemonModal } from "./ui.js";

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
    statusElement.textContent = "Point camera at a Pokémon and tap Scan!";
  } catch (error) {
    console.error("Camera access error:", error);
    statusElement.textContent = "⚠️ Unable to access camera. Check permissions or upload an image.";
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
 * Captures current frame from video onto canvas and simulates visual identification.
 */
export async function captureAndScanFrame(videoElement, canvasElement, statusElement) {
  if (!videoElement || !videoElement.videoWidth) {
    statusElement.textContent = "Camera stream not ready yet.";
    return null;
  }

  // Draw current frame to canvas
  const context = canvasElement.getContext("2d");
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  statusElement.textContent = "🔍 Analyzing image signature...";

  // Pick target Pokémon ID (or match random entry #001-#1025)
  const targetId = Math.floor(Math.random() * 1025) + 1;

  try {
    const pokemon = await fetchPokemon(targetId);
    statusElement.textContent = `✅ Target identified: ${pokemon.name.toUpperCase()}!`;
    return pokemon;
  } catch (err) {
    statusElement.textContent = "❌ Recognition failed. Try scanning again!";
    return null;
  }
}
