// ==========================================
// MINI-GAME ENGINE ("Who's That Pokémon?")
// ==========================================

import { fetchPokemon } from "./api.js";

let currentTarget = null;
let currentStreak = 0;
let highScore = Number(localStorage.getItem("minigame_highscore")) || 0;

/**
 * Generates a random National Pokédex ID.
 */
function getRandomId(min = 1, max = 1025) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sets up a new round: shuts the stage, displays a spinning Pokeball loader,
 * preloads the artwork, opens the shutter, and renders choice buttons.
 */
export async function startNewRound(
  imgElement,
  optionsContainer,
  feedbackElement,
  streakElem,
  highScoreElem
) {
  const shutter = document.getElementById("game-shutter");

  // 1. Reset stage image and snap shutter shut immediately without animation
  imgElement.className = "silhouette";
  imgElement.src = "";

  if (shutter) {
    shutter.classList.add("instant-close");
    shutter.classList.remove("open");
    shutter.style.visibility = "visible";
    shutter.style.opacity = "1";
    // Force reflow so the browser renders the closed state without transitioning
    void shutter.offsetHeight;
  }

  feedbackElement.textContent = "Who's That Pokémon?";
  feedbackElement.style.color = "";

  // 2. Display spinning Pokeball loader in options grid
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

    const pokemonList = await Promise.all(Array.from(ids).map((id) => fetchPokemon(id)));
    currentTarget = pokemonList[0];
    const choices = [...pokemonList].sort(() => Math.random() - 0.5);

    const targetSrc = currentTarget.officialArtwork || currentTarget.image;

    // 4. Preload artwork buffer before lifting shutter
    await new Promise((resolve) => {
      const preloader = new Image();
      preloader.src = targetSrc;
      preloader.onload = resolve;
      preloader.onerror = resolve;
    });

    // 5. Mount loaded image to stage
    imgElement.src = targetSrc;

    // 6. Restore animation and slide open the Pokeball shutter
    if (shutter) {
      shutter.classList.remove("instant-close");
      setTimeout(() => {
        shutter.classList.add("open");
      }, 120);
    }

    // 7. Render interactive choice buttons
    optionsContainer.innerHTML = choices
      .map(
        (p) =>
          `<button class="option-btn" data-name="${p.name}">${p.name.toUpperCase()}</button>`
      )
      .join("");
  } catch (error) {
    feedbackElement.textContent = "Failed to load mini-game round. Try again!";
    if (shutter) {
      shutter.classList.remove("instant-close");
      shutter.classList.add("open");
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
  const isCorrect = selectedName.toLowerCase() === currentTarget.name.toLowerCase();

  // Reveal sprite
  imgElement.classList.add("revealed");

  // Play audio cry if available
  if (currentTarget?.cry) {
    const audio = new Audio(currentTarget.cry);
    audio.volume = 0.6;
    audio.play().catch((err) => console.error("Audio playback error:", err));
  }

  // Highlight buttons and disable repeated clicks
  const buttons = optionsContainer.querySelectorAll(".option-btn");
  buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.name.toLowerCase() === currentTarget.name.toLowerCase()) {
      btn.classList.add("correct");
    } else if (btn.dataset.name.toLowerCase() === selectedName.toLowerCase() && !isCorrect) {
      btn.classList.add("wrong");
    }
  });

  // Score & streak management
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