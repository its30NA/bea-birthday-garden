'use strict';

/* =============================================================
   Bea's Birthday Garden — behaviour
   Sections: config, fireflies, intro sequence, bloom interaction,
   butterflies, falling petals, magic moment / finale, music,
   hidden tap-star surprise, service worker registration.
   ============================================================= */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// All the numbers that drive the pacing live here, named, so nothing
// below is a bare magic number. Durations are in milliseconds.
const CONFIG = {
  music: {
    // Served via jsDelivr's GitHub CDN mirror rather than the GitHub Pages
    // URL directly: GitHub Pages has no way to set custom response headers,
    // and it serves .mp3 as "audio/mp3" (non-standard) instead of the
    // correct "audio/mpeg" -- Chrome tolerates that, real Safari on iPhone
    // silently refuses to play it. jsDelivr mirrors the same repo file
    // with the correct MIME type. To replace the track later, just push
    // a new file at the same path -- this URL keeps working unchanged
    // (it may take a few hours for jsDelivr's cache to pick up the change).
    src: 'https://cdn.jsdelivr.net/gh/its30NA/bea-birthday-garden@main/assets/music/birthday-piano.mp3',
  },
  fireflies: {
    count: 24,
    reducedCount: 10,
    arriveSpanMs: 3000, // fireflies finish appearing over roughly this long
  },
  intro: {
    // Each step waits for the previous fade to fully finish (fade duration
    // is --dur-intro-fade, 900ms in style.css) before starting the next,
    // so "A little birthday surprise..." and "For Bea" never overlap.
    line1Delay: 400, // fade in starts; fully visible ~1300ms
    line1FadeOutDelay: 2000, // fade out starts; fully gone ~2900ms
    line2Delay: 2950, // fade in starts once line 1 has cleared
    beginButtonDelay: 4500,
    leaveTransitionMs: 1100, // must match .scene-intro.is-leaving transition
  },
  bloom: {
    // must stay roughly in sync with the transition-delays in style.css
    sequenceMs: 2300,
    sparkleAtMs: 1400,
    tapBounceMs: 320,
    butterflyAfterNth: 3,
  },
  finale: {
    titleADelay: 1000,
    titleBDelay: 1900,
    messageDelay: 3100,
    completeDelay: 4400,
  },
  petals: {
    firstSpawnDelay: 2500,
    minInterval: 4500,
    maxInterval: 8000,
  },
  butterflies: {
    minDuration: 16,
    maxDuration: 24,
    minPause: 3000,
    maxPause: 8000,
  },
  tapStar: {
    lifespanMs: 2000,
  },
};

let bloomedCount = 0;
let experienceComplete = false;

/* ---------- Fireflies ---------- */

function initFireflies() {
  const container = document.getElementById('fireflies');
  const count = REDUCED_MOTION ? CONFIG.fireflies.reducedCount : CONFIG.fireflies.count;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const firefly = document.createElement('div');
    firefly.className = 'firefly';
    const peak = (0.45 + Math.random() * 0.35).toFixed(2);
    const driftDelay = (Math.random() * 6).toFixed(2);
    const arriveDelay = Math.round((i / count) * CONFIG.fireflies.arriveSpanMs);

    firefly.style.left = `${Math.random() * 100}%`;
    firefly.style.top = `${Math.random() * 90}%`;
    firefly.style.setProperty('--firefly-peak', peak);
    firefly.style.opacity = peak; // static fallback if animations are disabled
    firefly.style.animationDelay = `${driftDelay}s, ${arriveDelay}ms`;
    fragment.appendChild(firefly);
  }
  container.appendChild(fragment);
}

/* ---------- Scene 1: intro sequence ---------- */

function runIntroSequence() {
  const line1 = document.querySelector('.intro-line--one');
  const line2 = document.querySelector('.intro-line--two');
  const beginBtn = document.getElementById('beginBtn');
  const { line1Delay, line1FadeOutDelay, line2Delay, beginButtonDelay } = CONFIG.intro;

  setTimeout(() => line1.classList.add('is-visible'), line1Delay);
  setTimeout(() => line1.classList.remove('is-visible'), line1FadeOutDelay);
  setTimeout(() => line2.classList.add('is-visible'), line2Delay);
  setTimeout(() => beginBtn.classList.add('is-visible'), beginButtonDelay);

  beginBtn.addEventListener('click', beginExperience, { once: true });
}

function beginExperience() {
  const intro = document.getElementById('sceneIntro');
  const garden = document.getElementById('sceneGarden');

  startMusic(); // called directly from the tap so autoplay is allowed
  intro.classList.add('is-leaving');
  setTimeout(() => {
    intro.hidden = true;
    garden.hidden = false;
    startPetalFalling();
  }, CONFIG.intro.leaveTransitionMs);
}

/* ---------- Scene 2 & 3: blooming ---------- */

function initGarden() {
  const plants = document.querySelectorAll('.plant');
  plants.forEach((plant) => {
    plant.addEventListener('click', () => handleBloom(plant, plants.length));
  });
}

function handleBloom(plant, totalPlants) {
  if (plant.classList.contains('bloomed')) return;

  // Some in-app browsers (e.g. WhatsApp's) block the autoplay attempt on
  // the Begin tap even though it's a genuine user gesture. Every flower
  // tap is another one, so retry here -- unless the person deliberately
  // stopped the music themselves, in which case leave it be.
  if (!musicPlaying && !musicManuallyStopped) {
    startMusic();
  }

  plant.classList.add('bloomed', 'tap-bounce');
  setTimeout(() => plant.classList.remove('tap-bounce'), CONFIG.bloom.tapBounceMs);
  setTimeout(() => createSparkles(plant.querySelector('.sparkle-burst')), CONFIG.bloom.sparkleAtMs);

  bloomedCount += 1;

  if (bloomedCount === CONFIG.bloom.butterflyAfterNth) {
    spawnButterflies(1);
  }
  if (bloomedCount === totalPlants) {
    spawnButterflies(2);
    setTimeout(startMagicMoment, CONFIG.bloom.sequenceMs);
  }
}

function createSparkles(container) {
  if (!container || REDUCED_MOTION) return;
  const count = 6;
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span');
    spark.className = 'sparkle-particle';
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 18 + Math.random() * 10;
    spark.style.setProperty('--sparkle-x', `${(Math.cos(angle) * distance).toFixed(1)}px`);
    spark.style.setProperty('--sparkle-y', `${(Math.sin(angle) * distance).toFixed(1)}px`);
    spark.style.setProperty('--sparkle-delay', `${(i * 0.05).toFixed(2)}s`);
    container.appendChild(spark);
    setTimeout(() => spark.remove(), 1100);
  }
}

/* ---------- Butterflies ---------- */

function spawnButterflies(newCount) {
  if (REDUCED_MOTION) return;
  for (let i = 0; i < newCount; i++) {
    const initialDelay = i === 0 && bloomedCount <= CONFIG.bloom.butterflyAfterNth ? 0 : Math.random() * 4000;
    launchButterfly(initialDelay);
  }
}

function launchButterfly(initialDelay) {
  const container = document.getElementById('butterflies');
  const { minDuration, maxDuration, minPause, maxPause } = CONFIG.butterflies;

  const flyOnce = () => {
    const butterfly = document.createElement('div');
    butterfly.className = 'butterfly';
    const duration = minDuration + Math.random() * (maxDuration - minDuration);

    butterfly.style.setProperty('--start-y', `${20 + Math.random() * 55}%`);
    butterfly.style.setProperty('--start-x', `${-10 - Math.random() * 5}%`);
    butterfly.style.setProperty('--travel-x', `${55 + Math.random() * 25}vw`);
    butterfly.style.setProperty('--travel-y', `${(Math.random() * 20 - 10).toFixed(1)}vh`);
    butterfly.style.setProperty('--flight-duration', `${duration.toFixed(1)}s`);

    const wing = document.createElement('div');
    wing.className = 'butterfly-wing';
    butterfly.appendChild(wing);
    container.appendChild(butterfly);

    setTimeout(() => {
      butterfly.remove();
      const pause = minPause + Math.random() * (maxPause - minPause);
      setTimeout(flyOnce, pause);
    }, duration * 1000 + 200);
  };

  setTimeout(flyOnce, initialDelay);
}

/* ---------- Falling petals ---------- */

function startPetalFalling() {
  if (REDUCED_MOTION) return;
  const container = document.getElementById('petalsFalling');
  const { minInterval, maxInterval, firstSpawnDelay } = CONFIG.petals;

  const spawn = () => {
    const petal = document.createElement('div');
    petal.className = 'falling-petal';
    petal.style.setProperty('--petal-x', `${Math.random() * 100}%`);
    petal.style.setProperty('--petal-drift', `${(Math.random() * 80 - 40).toFixed(0)}px`);
    const duration = 8 + Math.random() * 5;
    petal.style.setProperty('--fall-duration', `${duration.toFixed(1)}s`);
    container.appendChild(petal);
    setTimeout(() => petal.remove(), duration * 1000 + 200);

    const next = minInterval + Math.random() * (maxInterval - minInterval);
    setTimeout(spawn, next);
  };

  setTimeout(spawn, firstSpawnDelay);
}

/* ---------- Scene 3: the magic moment ---------- */

function startMagicMoment() {
  document.body.classList.add('garden-bright');
  document.getElementById('glowPulse').classList.add('on');
  document.getElementById('fireflies').classList.add('bright');
  document.getElementById('gardenHint').style.opacity = '0';
  document.getElementById('finale').classList.add('active');
  if (!REDUCED_MOTION) {
    document.getElementById('app').classList.add('garden-zoom');
  }

  const titleA = document.querySelector('.title-line--a');
  const titleB = document.querySelector('.title-line--b');
  const messageBox = document.getElementById('messageBox');
  const { titleADelay, titleBDelay, messageDelay, completeDelay } = CONFIG.finale;

  setTimeout(() => titleA.classList.add('is-visible'), titleADelay);
  setTimeout(() => titleB.classList.add('is-visible'), titleBDelay);
  setTimeout(() => messageBox.classList.add('show'), messageDelay);
  setTimeout(() => { experienceComplete = true; }, completeDelay);
}

/* ---------- Music ---------- */
/* Playback is started from the Begin-button tap (see beginExperience),
   since that's the user gesture browsers require for audio autoplay.
   The floating button just reflects/toggles the resulting state. */

let musicBtn;
let musicLabel;
let musicIcon;
let audioEl;
let musicPlaying = false;
let musicManuallyStopped = false; // true only once the person taps the button to stop it

function initMusic() {
  musicBtn = document.getElementById('musicBtn');
  musicLabel = document.getElementById('musicLabel');
  musicIcon = document.querySelector('.music-icon');
  audioEl = document.getElementById('bgMusic');

  musicBtn.addEventListener('click', () => {
    if (musicPlaying) {
      pauseMusic();
    } else {
      startMusic();
    }
  });
}

function startMusic() {
  musicManuallyStopped = false;
  if (!audioEl.src) {
    audioEl.src = CONFIG.music.src;
  }
  audioEl.play().then(() => {
    musicPlaying = true;
    updateMusicUI();
  }).catch(() => {
    // Autoplay was blocked (rare, but some browsers still require a more
    // direct tap on the button itself) -- it just stays offered as "Play Music".
    musicPlaying = false;
    updateMusicUI();
  });
}

function pauseMusic() {
  audioEl.pause();
  musicPlaying = false;
  musicManuallyStopped = true;
  updateMusicUI();
}

function updateMusicUI() {
  musicBtn.setAttribute('aria-pressed', String(musicPlaying));
  musicLabel.textContent = musicPlaying ? 'Stop Music' : 'Play Music';
  musicIcon.textContent = musicPlaying ? '⏹' : '♪';
}

/* ---------- Hidden surprise: tiny tap stars, once the story is over ---------- */

function initHiddenSurprise() {
  document.addEventListener('pointerdown', (event) => {
    if (!experienceComplete) return;
    if (event.target.closest('.music-btn')) return;
    spawnTapStar(event.clientX, event.clientY);
  });
}

function spawnTapStar(x, y) {
  const star = document.createElement('div');
  star.className = 'tap-star';
  star.style.left = `${x}px`;
  star.style.top = `${y}px`;
  document.getElementById('tapSparkles').appendChild(star);
  setTimeout(() => star.remove(), CONFIG.tapStar.lifespanMs);
}

/* ---------- Service worker (offline support / add to home screen) ---------- */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is a nice-to-have, not required */ });
  });
}

/* ---------- Boot ---------- */

function init() {
  initFireflies();
  runIntroSequence();
  initGarden();
  initMusic();
  initHiddenSurprise();
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
