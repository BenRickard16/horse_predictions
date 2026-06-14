const uploadForm = document.querySelector("#uploadForm");
const raceFile = document.querySelector("#raceFile");
const nSims = document.querySelector("#nSims");
const tuneSims = document.querySelector("#tuneSims");
const statusBox = document.querySelector("#status");
const courseSelect = document.querySelector("#courseSelect");
const timeSelect = document.querySelector("#timeSelect");
const resultsBody = document.querySelector("#resultsBody");
const raceTitle = document.querySelector("#raceTitle");
const raceMeta = document.querySelector("#raceMeta");
const metricsPanel = document.querySelector("#metrics");
const downloads = document.querySelector("#downloads");

let predictionRows = [];
let raceTimes = {};

function setStatus(message, type = "idle") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function probabilityCell(value, secondary = false) {
  const pct = Math.max(0, Math.min(100, Number(value || 0) * 100));
  return `
    <div class="bar-cell">
      <div class="prob">${formatPercent(value)}</div>
      <div class="bar ${secondary ? "secondary" : ""}">
        <span style="width:${pct}%"></span>
      </div>
    </div>
  `;
}

function populateCourses(courses) {
  courseSelect.innerHTML = "";
  courses.forEach((course) => {
    const option = document.createElement("option");
    option.value = course;
    option.textContent = course;
    courseSelect.appendChild(option);
  });
  courseSelect.disabled = courses.length === 0;
  populateTimes();
}

function populateTimes() {
  const selectedCourse = courseSelect.value;
  const times = raceTimes[selectedCourse] || [];
  timeSelect.innerHTML = "";
  times.forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    timeSelect.appendChild(option);
  });
  timeSelect.disabled = times.length === 0;
  renderRace();
}

function renderRace() {
  const course = courseSelect.value;
  const time = timeSelect.value;
  const rows = predictionRows
    .filter((row) => String(row.Racecourse) === course && String(row.Time) === time)
    .sort((a, b) => Number(b.bayesian_place_prob) - Number(a.bayesian_place_prob));

  if (!rows.length) {
    raceTitle.textContent = "Select a race";
    raceMeta.textContent = "";
    resultsBody.innerHTML = '<tr><td colspan="4" class="empty">No horses found for this race.</td></tr>';
    return;
  }

  raceTitle.textContent = `${course} ${time}`;
  raceMeta.textContent = `${rows[0].Date} · ${rows.length} runners · ${rows[0].EW_Places} places`;
  resultsBody.innerHTML = rows
    .map((row) => `
      <tr>
        <td><strong>${row["Horse Name"]}</strong></td>
        <td>${probabilityCell(row.bayesian_place_prob)}</td>
        <td>${probabilityCell(row.model_v2_place_prob, true)}</td>
        <td><span class="prob">${formatPercent(row.bayesian_win_prob)}</span></td>
      </tr>
    `)
    .join("");
}

function renderMetrics(metrics) {
  metricsPanel.innerHTML = metrics
    .map((metric) => `
      <article class="metric-card">
        <h3>${metric.model}</h3>
        <div class="metric-grid">
          <div><span>AUC</span><strong>${Number(metric.auc).toFixed(3)}</strong></div>
          <div><span>Brier</span><strong>${Number(metric.brier).toFixed(3)}</strong></div>
          <div><span>Top 20%</span><strong>${formatPercent(metric.top_20_precision)}</strong></div>
        </div>
      </article>
    `)
    .join("");
}

function renderDownloads(files) {
  downloads.innerHTML = `
    <a href="${files.predictionsXlsx}">Predictions XLSX</a>
    <a href="${files.predictionsCsv}">Predictions CSV</a>
    <a href="${files.metricsCsv}">Metrics CSV</a>
  `;
}

courseSelect.addEventListener("change", populateTimes);
timeSelect.addEventListener("change", renderRace);

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!raceFile.files.length) {
    setStatus("Choose a race-card workbook first.", "error");
    return;
  }

  const button = uploadForm.querySelector("button");
  const formData = new FormData();
  formData.append("race_file", raceFile.files[0]);
  formData.append("n_sims", nSims.value);
  formData.append("tune_sims", tuneSims.value);

  button.disabled = true;
  raceFile.disabled = true;
  nSims.disabled = true;
  tuneSims.disabled = true;
  setStatus("Running the preparation, training, testing, and prediction pipeline. This can take a few minutes.", "running");

  try {
    const response = await fetch("/api/predict", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Prediction run failed.");
    }

    predictionRows = payload.rows;
    raceTimes = payload.raceTimes;
    populateCourses(payload.courses);
    renderMetrics(payload.metrics);
    renderDownloads(payload.files);
    setStatus(`Loaded ${predictionRows.length} runners from ${payload.courses.length} racecourses.`, "idle");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
    raceFile.disabled = false;
    nSims.disabled = false;
    tuneSims.disabled = false;
  }
});
