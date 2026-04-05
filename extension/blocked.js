const params = new URLSearchParams(window.location.search);
const domain = params.get("domain");

if (domain) {
  document.getElementById("blockedDomain").textContent = domain;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

function updateTimer() {
  chrome.storage.local.get(["focusMode", "startTime"], (data) => {
    if (data.focusMode && data.startTime) {
      const elapsed = Date.now() - data.startTime;
      document.getElementById("timer").textContent = formatTime(elapsed);
    }
  });
}

updateTimer();
setInterval(updateTimer, 1000);

// Temp allow button
document.getElementById("tempAllowBtn").addEventListener("click", () => {
  if (!domain) return;

  chrome.storage.local.get(["tempAllowedDomains"], (data) => {
    const tempAllowed = data.tempAllowedDomains || [];
    if (!tempAllowed.includes(domain)) {
      tempAllowed.push(domain);
    }
    chrome.storage.local.set({ tempAllowedDomains: tempAllowed }, () => {
      // Navigate to the originally blocked site
      window.location.href = "https://" + domain;
    });
  });
});
