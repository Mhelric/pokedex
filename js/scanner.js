// ==========================================
// CAMERA POKÉDEX SCANNER MODULE (TF.JS AI)
// Client-side AI Image Recognition via TensorFlow.js
// ==========================================

import { fetchPokemon } from "./api.js";

// Public hosted TensorFlow.js Pokémon Model URL
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/bd8J-v0L8/";

let model = null;
let mediaStream = null;

/**
 * Loads the TensorFlow.js model weights into browser memory.
 */
async function loadAIModel(statusElement) {
  if (model) return model;

  try {
    statusElement.textContent = "⏳ Loading AI Vision Model into browser memory...";
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";

    model = await tmImage.load(modelURL, metadataURL);
    statusElement.textContent = "✅ AI Vision Model Ready! Point camera and scan.";
    return model;
  } catch (err) {
    console.error("TF.js Model Load Error:", err);
    statusElement.textContent = "⚠️ Failed to load AI model. Check your internet connection.";
    return null;
  }
}

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

    // Load AI model into memory
    await loadAIModel(statusElement);
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
 * Runs image pixel tensor prediction on an HTML Image or Canvas element.
 */
async function predictImagePixels(imageOrCanvasElement, statusElement) {
  const loadedModel = await loadAIModel(statusElement);
  if (!loadedModel) return null;

  statusElement.textContent = "🤖 Analyzing image pixels & color signatures...";

  try {
    // Run prediction on canvas/image pixels
    const predictions = await loadedModel.predict(imageOrCanvasElement);

    if (!predictions || predictions.length === 0) {
      throw new Error("No predictions returned.");
    }

    // Sort predictions by highest probability score
    predictions.sort((a, b) => b.probability - a.probability);
    const topMatch = predictions;

    const confidence = Math.round(topMatch.probability * 100);
    const pokemonName = topMatch.className.toLowerCase().trim();

    if (confidence < 25) {
      statusElement.textContent = "❓ Unclear image signature. Try a clearer photo or closer angle!";
      return null;
    }

    statusElement.textContent = `🎯 Identified: ${pokemonName.toUpperCase()} (${confidence}% confidence)!`;

    // Fetch complete Pokédex data from PokéAPI
    return await fetchPokemon(pokemonName);
  } catch (err) {
    console.error("AI Prediction Error:", err);
    statusElement.textContent = "❌ Could not recognize Pokémon in this image. Try another photo!";
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

  return await predictImagePixels(canvasElement, statusElement);
}

/**
 * Classifies an uploaded photo File object directly using AI Vision.
 */
export async function scanUploadedFile(fileObject, statusElement) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(fileObject);
    img.onload = async () => {
      const scannedPokemon = await predictImagePixels(img, statusElement);
      URL.revokeObjectURL(img.src);
      resolve(scannedPokemon);
    };
    img.onerror = () => {
      statusElement.textContent = "⚠️ Failed to read image file.";
      resolve(null);
    };
  });
}