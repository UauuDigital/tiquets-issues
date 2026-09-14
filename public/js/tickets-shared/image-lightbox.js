// Lightbox compartit per obrir les captures de pantalla dins la mateixa
// pàgina (en lloc de navegar-hi directament), amb l'opció d'obrir-les en
// una altra pestanya si es vol veure-les a mida completa i de navegar
// entre totes les captures d'un mateix tiquet amb les fletxes.
let lightboxUrls = [];
let lightboxIndex = 0;

function renderLightboxImage() {
  const url = lightboxUrls[lightboxIndex];
  imageLightboxImg.src = url;
  imageLightboxOpenNew.href = url;
  const hasMultiple = lightboxUrls.length > 1;
  imageLightboxPrev.hidden = !hasMultiple;
  imageLightboxNext.hidden = !hasMultiple;
}

function showLightboxAt(index) {
  lightboxIndex = (index + lightboxUrls.length) % lightboxUrls.length;
  renderLightboxImage();
}

function openImageLightbox(urls, index) {
  lightboxUrls = Array.isArray(urls) ? urls : [urls];
  lightboxIndex = index || 0;
  renderLightboxImage();
  imageLightbox.showModal();
}

imageLightboxPrev.addEventListener('click', () => showLightboxAt(lightboxIndex - 1));
imageLightboxNext.addEventListener('click', () => showLightboxAt(lightboxIndex + 1));

imageLightboxClose.addEventListener('click', () => imageLightbox.close());
imageLightbox.addEventListener('click', (e) => {
  if (e.target.closest('.image-lightbox-arrow')) return;
  const rect = imageLightbox.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) imageLightbox.close();
});
imageLightbox.addEventListener('keydown', (e) => {
  if (lightboxUrls.length <= 1) return;
  if (e.key === 'ArrowLeft') showLightboxAt(lightboxIndex - 1);
  if (e.key === 'ArrowRight') showLightboxAt(lightboxIndex + 1);
});
imageLightbox.addEventListener('close', () => {
  imageLightboxImg.src = '';
  lightboxUrls = [];
});
