// ==========================================
// CAMERA POKÉDEX SCANNER MODULE (AI VISION)
// Uses Hugging Face Inference API for image recognition
// ==========================================

import { fetchPokemon } from "./api.js";

// Free Hugging Face AI Vision Model Endpoint trained on Pokémon species
const HF_VISION_MODEL_URL =
  "https://api-inference.huggingface.co/models/imbr/pokemon-classifier";

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
    statusElement.textContent = "Point camera at a Pokémon and tap Scan Target!";
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
 * Sends image Blob/Bytes to Hugging Face AI Vision model for visual classification.
 */
async function classifyImageWithAI(imageBlob, statusElement) {
  statusElement.textContent = "🤖 AI model analyzing image features & pixels...";

  try {
    const response = await fetch(HF_VISION_MODEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: imageBlob,
    });

    if (response.status === 503) {
      // Model cold boot state
      statusElement.textContent = "⏳ AI Model is warming up... Please try again in 5 seconds!";
      return null;
    }

    if (!response.ok) {
      throw new Error(`AI Classification failed with status ${response.status}`);
    }

    const predictions = await response.json();

    if (!Array.isArray(predictions) || predictions.length === 0) {
      throw new Error("No predictions returned from AI vision model.");
    }

    // Extract top prediction (e.g., { label: "Pikachu", score: 0.98 })
    const topPrediction = predictions;
    const rawLabel = topPrediction.label || "";
    const confidencePercent = Math.round((topPrediction.score || 0) * 100);

    // Clean up label name (remove form suffixes if needed)
    const cleanedName = rawLabel.split("-").toLowerCase().trim();

    statusElement.textContent = `🎯 Identified: ${cleanedName.toUpperCase()} (${confidencePercent}% match)!`;

    // Fetch full Pokédex entry from PokéAPI
    return await fetchPokemon(cleanedName);
  } catch (err) {
    console.error("AI Recognition Error:", err);
    statusElement.textContent = "❌ AI could not recognize the Pokémon in this image. Try another angle or clearer photo!";
    return null;
  }
}

/**
 * Captures the current camera video frame onto canvas and runs AI visual classification.
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

  // Convert canvas frame to Image Blob
  return new Promise((resolve) => {
    canvasElement.toBlob(async (blob) => {
      if (!blob) {
        statusElement.textContent = "⚠️ Failed to capture image frame.";
        resolve(null);
        return;
      }
      const scannedPokemon = await classifyImageWithAI(blob, statusElement);
      resolve(scannedPokemon);
    }, "image/jpeg", 0.9);
  });
}

/**
 * Classifies an uploaded photo File object directly using AI Vision.
 */
export async function scanUploadedFile(fileObject, statusElement) {
  return await classifyImageWithAI(fileObject, statusElement);
}
