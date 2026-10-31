// ==========================================
// MINI-GAME ENGINE ("Who's That Pokémon?")
// ==========================================

import { fetchPokemonMinigame } from "./api.js";

let currentTarget = null;
let currentStreak = 0;
let highScore = Number(localStorage.getItem("minigame_highscore")) || 0;
let minigameRoundToken = 0;
let activeMinigameController = null;
let activeCryAudio = null;

export function stopMinigame() {
  if (activeMinigameController) {
    activeMinigameController.abort();
    activeMinigameController = null;
  }
  if (activeCryAudio) {
    activeCryAudio.pause();
    activeCryAudio.src = "";
    activeCryAudio = null;
  }
}

/**
 * Generates a random National Pokédex ID.
 */
function getRandomId(min = 1, max = 1025) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Unbiased in-place Fisher–Yates shuffle (returns a new shuffled copy).
 */
export function fisherYatesShuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Sets up a new round with token guard against modal reopen race conditions.
 */
export async function startNewRound(
  imgElement,
  optionsContainer,
  feedbackElement,
  streakElem,
  highScoreElem
) {
  stopMinigame();
  activeMinigameController = new AbortController();
  const signal = activeMinigameController.signal;

  const roundToken = ++minigameRoundToken;
  const gameModal = document.getElementById("game-modal");
  const shutter = document.getElementById("game-shutter");

  // 1. Reset stage image and snap shutter shut immediately
  imgElement.className = "silhouette";
  imgElement.src = "";

  if (shutter) {
    shutter.classList.add("instant-close");
    shutter.classList.remove("open");
    shutter.style.visibility = "visible";
    shutter.style.opacity = "1";
    void shutter.offsetHeight;
  }

  feedbackElement.textContent = "Who's That Pokémon?";
  feedbackElement.style.color = "";

  // 2. Display loader in options grid
  optionsContainer.innerHTML = `
    <div class="game-options-loader">
      <div class="pokeball-spinner"></div>
      <span>Calling Pokémon...</span>
    </div>
  `;

  if (streakElem) streakElem.textContent = currentStreak;
  if (highScoreElem) highScoreElem.textContent = highScore;

  try {
    // 3. Select 4 unique IDs
    const ids = new Set();
    while (ids.size < 4) {
      ids.add(getRandomId(1, 1025));
    }

    const pokemonList = await Promise.all(
      Array.from(ids).map((id) => fetchPokemonMinigame(id, signal))
    );

    // Abort if stale or modal was closed
    if (signal.aborted || roundToken !== minigameRoundToken || gameModal?.classList.contains("hidden")) {
      return;
    }

    currentTarget = pokemonList[0];
    const choices = fisherYatesShuffle(pokemonList);
    const targetSrc = currentTarget.officialArtwork || currentTarget.image;

    // 4. Preload artwork buffer before lifting shutter
    await new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const preloader = new Image();
      preloader.src = targetSrc;
      preloader.onload = resolve;
      preloader.onerror = resolve;
      signal.addEventListener("abort", resolve, { once: true });
    });

    if (signal.aborted || roundToken !== minigameRoundToken || gameModal?.classList.contains("hidden")) {
      return;
    }

    imgElement.src = targetSrc;

    // 5. Open shutter
    if (shutter) {
      shutter.classList.remove("instant-close");
      setTimeout(() => {
        if (roundToken === minigameRoundToken) {
          shutter.classList.add("open");
        }
      }, 120);
    }

    // 6. Render choice buttons
    optionsContainer.innerHTML = choices
      .map(
        (p) =>
          `<button class="option-btn" data-name="${p.name}">${p.name.toUpperCase()}</button>`
      )
      .join("");
  } catch (error) {
    if (signal.aborted || error.name === "AbortError") {
      return;
    }
    if (roundToken === minigameRoundToken && !gameModal?.classList.contains("hidden")) {
      feedbackElement.textContent = "Failed to load mini-game round. Try again!";
      if (shutter) {
        shutter.classList.remove("instant-close");
        shutter.classList.add("open");
      }
    }
  } finally {
    if (activeMinigameController?.signal === signal) {
      activeMinigameController = null;
    }
  }
}

/**
 * Evaluates the chosen answer, reveals the sprite, plays audio cry, and updates streaks.
 */
export function handleGuess(
  selectedName,
  imgElement,
  feedbackElement,
  optionsContainer,
  nextBtn,
  streakElem,
  highScoreElem
) {
  if (!currentTarget) return;
  const isCorrect = selectedName.toLowerCase() === currentTarget.name.toLowerCase();

  imgElement.classList.add("revealed");

  if (currentTarget?.cry) {
    if (activeCryAudio) {
      activeCryAudio.pause();
      activeCryAudio.src = "";
    }
    activeCryAudio = new Audio(currentTarget.cry);
    activeCryAudio.volume = 0.6;
    activeCryAudio.play().catch((err) => console.error("Audio playback error:", err));
  }

  const buttons = optionsContainer.querySelectorAll(".option-btn");
  buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.name.toLowerCase() === currentTarget.name.toLowerCase()) {
      btn.classList.add("correct");
    } else if (btn.dataset.name.toLowerCase() === selectedName.toLowerCase() && !isCorrect) {
      btn.classList.add("wrong");
    }
  });

  if (isCorrect) {
    currentStreak++;
    if (currentStreak > highScore) {
      highScore = currentStreak;
      localStorage.setItem("minigame_highscore", highScore);
    }
    feedbackElement.textContent = `🎉 IT'S ${currentTarget.name.toUpperCase()}! Great guess!`;
    feedbackElement.style.color = "#4caf50";
  } else {
    currentStreak = 0;
    feedbackElement.textContent = `❌ It was ${currentTarget.name.toUpperCase()}! Streak reset.`;
    feedbackElement.style.color = "#ef5350";
  }

  if (streakElem) streakElem.textContent = currentStreak;
  if (highScoreElem) highScoreElem.textContent = highScore;

  if (nextBtn) nextBtn.classList.add("visible");
}