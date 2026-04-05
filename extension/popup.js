const toggleBtn = document.getElementById("toggleBtn");
const timerEl = document.getElementById("timer");
const timerValue = document.getElementById("timerValue");
const domainInput = document.getElementById("domainInput");
const addDomainBtn = document.getElementById("addDomainBtn");
const domainList = document.getElementById("domainList");
const allowedInput = document.getElementById("allowedInput");
const addAllowedBtn = document.getElementById("addAllowedBtn");
const allowedList = document.getElementById("allowedList");
const tempAllowedSection = document.getElementById("tempAllowedSection");
const tempAllowedList = document.getElementById("tempAllowedList");
const historyList = document.getElementById("historyList");

let timerInterval = null;
let currentFocusMode = false;

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

function parseDomains(input) {
  return input
    .split(/[,\s\n]+/)
    .map((d) => {
      d = d.trim().toLowerCase();
      d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      d = d.replace(/^www\./, "");
      return d;
    })
    .filter((d) => d.length > 0);
}

// --- Focus Mode Toggle ---

function updateToggleUI(isOn) {
  currentFocusMode = isOn;
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
      const endTime = Date.now();
      const duration = endTime - (data.startTime || endTime);
      const history = data.history || [];
      history.unshift({ startTime: data.startTime, endTime, duration });
      if (history.length > 50) history.length = 50;

      chrome.storage.local.set(
        { focusMode: false, startTime: null, history, tempAllowedDomains: [] },
        () => {
          updateToggleUI(false);
          stopTimerUpdate();
          renderHistory(history);
          renderTempAllowed([]);
          // Re-render blocked domains to hide temp-allow buttons
          chrome.storage.local.get(
            ["blockedDomains", "tempAllowedDomains"],
            (d) => renderDomains(d.blockedDomains || [], d.tempAllowedDomains || [])
          );
        }
      );
    } else {
      const startTime = Date.now();
      chrome.storage.local.set({ focusMode: true, startTime }, () => {
        updateToggleUI(true);
        startTimerUpdate(startTime);
        // Re-render to show temp-allow buttons
        chrome.storage.local.get(
          ["blockedDomains", "tempAllowedDomains"],
          (d) => renderDomains(d.blockedDomains || [], d.tempAllowedDomains || [])
        );
      });
    }
  });
});

// --- Blocked Domain Management ---

function renderDomains(domains, tempAllowed) {
  domainList.innerHTML = "";
  if (!domains || domains.length === 0) return;
  tempAllowed = tempAllowed || [];

  domains.forEach((domain) => {
    const li = document.createElement("li");
    const isTempAllowed = tempAllowed.includes(domain);

    const nameSpan = document.createElement("span");
    nameSpan.className = "domain-name" + (isTempAllowed ? " temp-allowed" : "");
    nameSpan.textContent = domain;

    const actions = document.createElement("span");
    actions.className = "btn-actions";

    if (isTempAllowed) {
      const badge = document.createElement("span");
      badge.className = "temp-allowed-badge";
      badge.textContent = "許可中";
      actions.appendChild(badge);

      const revokeBtn = document.createElement("button");
      revokeBtn.className = "btn-revoke";
      revokeBtn.textContent = "取消";
      revokeBtn.addEventListener("click", () => revokeTempAllow(domain));
      actions.appendChild(revokeBtn);
    } else if (currentFocusMode) {
      const tempBtn = document.createElement("button");
      tempBtn.className = "btn-temp-allow";
      tempBtn.textContent = "一時許可";
      tempBtn.addEventListener("click", () => tempAllow(domain));
      actions.appendChild(tempBtn);
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeDomain(domain));
    actions.appendChild(removeBtn);

    li.appendChild(nameSpan);
    li.appendChild(actions);
    domainList.appendChild(li);
  });
}

function addDomains() {
  const raw = domainInput.value;
  if (!raw.trim()) return;

  const newDomains = parseDomains(raw);
  if (newDomains.length === 0) return;

  chrome.storage.local.get(["blockedDomains", "tempAllowedDomains"], (data) => {
    const domains = data.blockedDomains || [];
    const tempAllowed = data.tempAllowedDomains || [];
    let added = false;
    for (const d of newDomains) {
      if (!domains.includes(d)) {
        domains.push(d);
        added = true;
      }
    }
    if (!added) {
      domainInput.value = "";
      return;
    }
    chrome.storage.local.set({ blockedDomains: domains }, () => {
      domainInput.value = "";
      renderDomains(domains, tempAllowed);
    });
  });
}

function removeDomain(domain) {
  chrome.storage.local.get(["blockedDomains", "tempAllowedDomains"], (data) => {
    const domains = (data.blockedDomains || []).filter((d) => d !== domain);
    // Also remove from temp allowed if present
    const tempAllowed = (data.tempAllowedDomains || []).filter((d) => d !== domain);
    chrome.storage.local.set(
      { blockedDomains: domains, tempAllowedDomains: tempAllowed },
      () => {
        renderDomains(domains, tempAllowed);
        renderTempAllowed(tempAllowed);
      }
    );
  });
}

addDomainBtn.addEventListener("click", addDomains);
domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomains();
});

// --- Temp Allow ---

function tempAllow(domain) {
  chrome.storage.local.get(["tempAllowedDomains", "blockedDomains"], (data) => {
    const tempAllowed = data.tempAllowedDomains || [];
    if (!tempAllowed.includes(domain)) {
      tempAllowed.push(domain);
    }
    chrome.storage.local.set({ tempAllowedDomains: tempAllowed }, () => {
      renderDomains(data.blockedDomains || [], tempAllowed);
      renderTempAllowed(tempAllowed);
    });
  });
}

function revokeTempAllow(domain) {
  chrome.storage.local.get(["tempAllowedDomains", "blockedDomains"], (data) => {
    const tempAllowed = (data.tempAllowedDomains || []).filter((d) => d !== domain);
    chrome.storage.local.set({ tempAllowedDomains: tempAllowed }, () => {
      renderDomains(data.blockedDomains || [], tempAllowed);
      renderTempAllowed(tempAllowed);
    });
  });
}

function renderTempAllowed(tempAllowed) {
  if (!tempAllowed || tempAllowed.length === 0) {
    tempAllowedSection.style.display = "none";
    return;
  }
  tempAllowedSection.style.display = "block";
  tempAllowedList.innerHTML = "";

  tempAllowed.forEach((domain) => {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.className = "domain-name";
    nameSpan.textContent = domain;

    const revokeBtn = document.createElement("button");
    revokeBtn.className = "btn-revoke";
    revokeBtn.textContent = "取消";
    revokeBtn.addEventListener("click", () => revokeTempAllow(domain));

    li.appendChild(nameSpan);
    li.appendChild(revokeBtn);
    tempAllowedList.appendChild(li);
  });
}

// --- Allowed (Excluded) Subdomain Management ---

function renderAllowedDomains(domains) {
  allowedList.innerHTML = "";
  if (!domains || domains.length === 0) return;

  domains.forEach((domain) => {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.className = "domain-name";
    nameSpan.textContent = domain;

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeAllowedDomain(domain));

    li.appendChild(nameSpan);
    li.appendChild(removeBtn);
    allowedList.appendChild(li);
  });
}

function addAllowedDomains() {
  const raw = allowedInput.value;
  if (!raw.trim()) return;

  const newDomains = parseDomains(raw);
  if (newDomains.length === 0) return;

  chrome.storage.local.get(["allowedDomains"], (data) => {
    const domains = data.allowedDomains || [];
    let added = false;
    for (const d of newDomains) {
      if (!domains.includes(d)) {
        domains.push(d);
        added = true;
      }
    }
    if (!added) {
      allowedInput.value = "";
      return;
    }
    chrome.storage.local.set({ allowedDomains: domains }, () => {
      allowedInput.value = "";
      renderAllowedDomains(domains);
    });
  });
}

function removeAllowedDomain(domain) {
  chrome.storage.local.get(["allowedDomains"], (data) => {
    const domains = (data.allowedDomains || []).filter((d) => d !== domain);
    chrome.storage.local.set({ allowedDomains: domains }, () => {
      renderAllowedDomains(domains);
    });
  });
}

addAllowedBtn.addEventListener("click", addAllowedDomains);
allowedInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addAllowedDomains();
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
  ["focusMode", "startTime", "blockedDomains", "allowedDomains", "tempAllowedDomains", "history"],
  (data) => {
    const isOn = data.focusMode || false;
    updateToggleUI(isOn);

    if (isOn && data.startTime) {
      startTimerUpdate(data.startTime);
    }

    const tempAllowed = data.tempAllowedDomains || [];
    renderDomains(data.blockedDomains || [], tempAllowed);
    renderAllowedDomains(data.allowedDomains || []);
    renderTempAllowed(tempAllowed);
    renderHistory(data.history || []);
  }
);
