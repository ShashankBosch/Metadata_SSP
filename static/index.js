// ==================== MODAL BEHAVIOR ====================
window.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("introModal");
  const closeBtn = document.getElementById("closeModalBtn");
  const pageWrapper = document.getElementById("pageWrapper");

  if (modal && closeBtn && pageWrapper) {
    modal.style.display = "flex";
    pageWrapper.classList.add("blurred");

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      pageWrapper.classList.remove("blurred");
    });
  }
});

// ==================== CARD NAVIGATION ====================
document.addEventListener("DOMContentLoaded", () => {
  const azureCard = document.getElementById("azureCard");
  const awsCard = document.getElementById("awsCard");
  const gcpCard = document.getElementById("gcpCard");

  function navigateToMetadata(platform) {
    window.location.href = `/components/metadata?platform=${platform}`;
  }

  if (azureCard) azureCard.addEventListener("click", () => navigateToMetadata("Azure"));
  if (awsCard) awsCard.addEventListener("click", () => navigateToMetadata("AWS"));
  if (gcpCard) gcpCard.addEventListener("click", () => navigateToMetadata("GCP"));
});

// ==================== Carousel code ====================
const track = document.querySelector('.carousel-track');
const slides = document.querySelectorAll('.carousel-slide');
let currentIndex = 0;
let interval;

function moveSlides() {
  currentIndex = (currentIndex + 1) % slides.length;
  track.style.transform = `translateX(-${(1150 + 40) * currentIndex}px)`; // width + margin
}

function startCarousel() {
  interval = setInterval(moveSlides, 2000);
}

function pauseCarousel() {
  clearInterval(interval);
}

// Pause on image hover
slides.forEach(slide => {
  slide.addEventListener('mouseenter', pauseCarousel);
  slide.addEventListener('mouseleave', startCarousel);
});

startCarousel();
