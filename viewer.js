function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  linkDiv.innerHTML = '';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload');

  // Real-time smooth progress
  let lastPercent = 0;
  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100;

      // Smooth transition: animate to new percent
      const diff = percent - lastPercent;
      let current = lastPercent;
      const step = diff / 10; // 10 small steps

      const animate = () => {
        current += step;
        if ((step > 0 && current < percent) || (step < 0 && current > percent)) {
          progressBar.style.width = current.toFixed(1) + '%';
          requestAnimationFrame(animate);
        } else {
          progressBar.style.width = percent.toFixed(1) + '%';
          lastPercent = percent;
        }
      };
      animate();
    }
  });

  xhr.onload = () => {
    if(xhr.status === 200){
      const res = JSON.parse(xhr.responseText);
      linkDiv.innerHTML = `<strong>Link:</strong> <a href="${res.link}" target="_blank">${res.link}</a>`;
    } else {
      linkDiv.innerHTML = `<span style="color:red;">Upload failed: ${xhr.statusText}</span>`;
    }
    progressContainer.style.display = 'none';
  };

  xhr.send(formData);
}
