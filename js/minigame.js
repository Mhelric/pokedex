//MINIGAME JS

import { fetchPokemon } from './api.js';

let currentTarget = null;
let currentStreak = 0;
let highScore = Number(localStorage.getItem('minigame_highscore')) || 0;

/**
 * Returns a random integer between min and max (inclusive).
 */
function getRandomId(min = 1, max = 1025) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a new game round with 1 target Pokémon and 3 distractor choices.
 */
export async function startNewRound(
  imgElement,
  optionsContainer,
  feedbackElement,
  streakElem,
  highScoreElem
) {
  // 1. Reset UI State
  imgElement.className = 'silhouette';
  feedbackElement.textContent = "Who's That Pokémon?";
  feedbackElement.style.color = "#ffffff";
  optionsContainer.innerHTML = '<p>Loading mystery Pokémon...</p>';

  if (streakElem) streakElem.textContent = currentStreak;
  if (highScoreElem) highScoreElem.textContent = highScore;

  try {
    // 2. Select 4 unique random IDs
    const ids = new Set();
    while (ids.size < 4) {
      ids.add(getRandomId(1, 1025));
    }
    const idArray = Array.from(ids);

    // 3. Fetch data for all 4 Pokémon in parallel
    const pokemonList = await Promise.all(idArray.map((id) => fetchPokemon(id)));

    // Target is the first Pokémon in the fetched list
    currentTarget = pokemonList[0];

    // Shuffle all 4 choices so target isn't always option #1
    const choices = [...pokemonList].sort(() => Math.random() - 0.5);

    // 4. Set Image Source
    imgElement.src = currentTarget.image;

    // 5. Render 4 Option Buttons
    optionsContainer.innerHTML = choices
      .map(
        (p) =>
          `<button class="option-btn" data-name="${p.name}">${p.name.toUpperCase()}</button>`
      )
      .join('');
  } catch (error) {
    feedbackElement.textContent = 'Failed to load mini-game round. Try again!';
  }
}

/**
 * Evaluates the user's guess and plays the Pokémon's cry on reveal!
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

  // 1. Reveal image
  imgElement.classList.add('revealed');

  // 2. 🔊 Play official audio cry on reveal if available
  if (currentTarget && currentTarget.cry) {
    const audio = new Audio(currentTarget.cry);
    audio.volume = 0.6; // Adjust volume (0.0 to 1.0)
    audio.play().catch((err) => console.error("Audio playback error:", err));
  }

  // 3. Disable all option buttons and highlight correct/wrong
  const buttons = optionsContainer.querySelectorAll('.option-btn');
  buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.name.toLowerCase() === currentTarget.name.toLowerCase()) {
      btn.classList.add('correct');
    } else if (btn.dataset.name.toLowerCase() === selectedName.toLowerCase() && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  // 4. Update score & feedback message
  if (isCorrect) {
    currentStreak++;
    if (currentStreak > highScore) {
      highScore = currentStreak;
      localStorage.setItem('minigame_highscore', highScore);
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

  // 5. Show Next Button
  if (nextBtn) nextBtn.style.display = 'inline-block';
}