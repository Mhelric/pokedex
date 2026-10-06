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
 * Sets up a new round: picks 4 random Pokémon, sets the target, and creates choice buttons.
 */
export async function startNewRound(
  imgElement,
  optionsContainer,
  feedbackElement,
  streakElem,
  highScoreElem
) {
  // Reset UI elements to unrevealed state
  imgElement.className = "silhouette";
  feedbackElement.textContent = "Who's That Pokémon?";
  feedbackElement.style.color = "#ffffff";
  optionsContainer.innerHTML = '<p class="game-loading">Loading mystery Pokémon...</p>';

  if (streakElem) streakElem.textContent = currentStreak;
  if (highScoreElem) highScoreElem.textContent = highScore;

  try {
    // Select 4 unique IDs
    const ids = new Set();
    while (ids.size < 4) {
      ids.add(getRandomId(1, 1025));
    }

    // Fetch all 4 options simultaneously
    const pokemonList = await Promise.all(Array.from(ids).map((id) => fetchPokemon(id)));

    // Designate first fetch as target, then shuffle for button layout
    currentTarget = pokemonList[0];
    const choices = [...pokemonList].sort(() => Math.random() - 0.5);

    // Apply mystery artwork
    imgElement.src = currentTarget.officialArtwork || currentTarget.image;

    // Render choice buttons
    optionsContainer.innerHTML = choices
      .map(
        (p) =>
          `<button class="option-btn" data-name="${p.name}">${p.name.toUpperCase()}</button>`
      )
      .join("");
  } catch (error) {
    feedbackElement.textContent = "Failed to load mini-game round. Try again!";
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

  // Score management
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

  if (nextBtn) nextBtn.style.display = "inline-block";
}