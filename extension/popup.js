const toggleBtn = document.getElementById("toggleBtn");
const timerEl = document.getElementById("timer");
const timerValue = document.getElementById("timerValue");
const domainInput = document.getElementById("domainInput");
const addDomainBtn = document.getElementById("addDomainBtn");
const domainList = document.getElementById("domainList");
const historyList = document.getElementById("historyList");

let timerInterval = null;

// --- Utilities ---

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

// --- Focus Mode Toggle ---

function updateToggleUI(isOn) {
  toggleBtn.textContent = isOn ? "ON" : "OFF";
  toggleBtn.className = "toggle-btn " + (isOn ? "on" : "off");
  timerEl.style.display = isOn ? "flex" : "none";
}

function startTimerUpdate(startTime) {
  clearInterval(timerInterval);
  function update() {
    timerValue.textContent = formatTime(Date.now() - startTime);
  }
  update();
  timerInterval = setInterval(update, 1000);
}

function stopTimerUpdate() {
  clearInterval(timerInterval);
  timerValue.textContent = "00:00:00";
}

toggleBtn.addEventListener("click", () => {
  chrome.storage.local.get(["focusMode", "startTime", "history"], (data) => {
    const wasOn = data.focusMode || false;

    if (wasOn) {
      // Turn OFF: save session to history
      const endTime = Date.now();
      const duration = endTime - (data.startTime || endTime);
      const history = data.history || [];
      history.unshift({ startTime: data.startTime, endTime, duration });
      // Keep max 50 entries
      if (history.length > 50) history.length = 50;

      chrome.storage.local.set(
        { focusMode: false, startTime: null, history },
        () => {
          updateToggleUI(false);
          stopTimerUpdate();
          renderHistory(history);
        }
      );
    } else {
      // Turn ON
      const startTime = Date.now();
      chrome.storage.local.set({ focusMode: true, startTime }, () => {
        updateToggleUI(true);
        startTimerUpdate(startTime);
      });
    }
  });
});

// --- Domain Management ---

function renderDomains(domains) {
  domainList.innerHTML = "";
  if (!domains || domains.length === 0) return;

  domains.forEach((domain) => {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.className = "domain-name";
    nameSpan.textContent = domain;

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeDomain(domain));

    li.appendChild(nameSpan);
    li.appendChild(removeBtn);
    domainList.appendChild(li);
  });
}

function addDomain() {
  let domain = domainInput.value.trim().toLowerCase();
  if (!domain) return;

  // Strip protocol and path
  domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  // Strip www prefix
  domain = domain.replace(/^www\./, "");

  if (!domain) return;

  chrome.storage.local.get(["blockedDomains"], (data) => {
    const domains = data.blockedDomains || [];
    if (domains.includes(domain)) {
      domainInput.value = "";
      return;
    }
    domains.push(domain);
    chrome.storage.local.set({ blockedDomains: domains }, () => {
      domainInput.value = "";
      renderDomains(domains);
    });
  });
}

function removeDomain(domain) {
  chrome.storage.local.get(["blockedDomains"], (data) => {
    const domains = (data.blockedDomains || []).filter((d) => d !== domain);
    chrome.storage.local.set({ blockedDomains: domains }, () => {
      renderDomains(domains);
    });
  });
}

addDomainBtn.addEventListener("click", addDomain);
domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

// --- Session History ---

function renderHistory(history) {
  historyList.innerHTML = "";

  if (!history || history.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-message";
    li.textContent = "履歴はまだありません";
    historyList.appendChild(li);
    return;
  }

  history.forEach((session) => {
    const li = document.createElement("li");

    const dateSpan = document.createElement("span");
    dateSpan.className = "history-date";
    dateSpan.textContent = formatDate(session.startTime);

    const durationSpan = document.createElement("span");
    durationSpan.className = "history-duration";
    durationSpan.textContent = formatTime(session.duration);

    li.appendChild(dateSpan);
    li.appendChild(durationSpan);
    historyList.appendChild(li);
  });
}

// --- Initialize ---

chrome.storage.local.get(
  ["focusMode", "startTime", "blockedDomains", "history"],
  (data) => {
    const isOn = data.focusMode || false;
    updateToggleUI(isOn);

    if (isOn && data.startTime) {
      startTimerUpdate(data.startTime);
    }

    renderDomains(data.blockedDomains || []);
    renderHistory(data.history || []);
  }
);
