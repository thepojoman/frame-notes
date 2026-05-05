const APP_VERSION = "v1.0.6";
const APP_UPDATED_AT = "2026-05-05 00:35 CT";

const state = {
  iso: 400,
  filmType: "Color",
  latitude: null,
  longitude: null,
  place: "Manual",
  weatherCloudCover: null,
  weatherUpdatedAt: null,
  recommendation: null,
  frames: JSON.parse(localStorage.getItem("frame-notes") || "[]"),
};

const apertures = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const shutters = [
  { label: "1", value: 1 },
  { label: "1/2", value: 0.5 },
  { label: "1/4", value: 0.25 },
  { label: "1/8", value: 1 / 8 },
  { label: "1/15", value: 1 / 15 },
  { label: "1/30", value: 1 / 30 },
  { label: "1/60", value: 1 / 60 },
  { label: "1/125", value: 1 / 125 },
  { label: "1/250", value: 1 / 250 },
  { label: "1/500", value: 1 / 500 },
  { label: "1/1000", value: 1 / 1000 },
];

const directionDegrees = {
  North: 0,
  Northeast: 45,
  East: 90,
  Southeast: 135,
  South: 180,
  Southwest: 225,
  West: 270,
  Northwest: 315,
};

const degreeDirections = [
  "North",
  "Northeast",
  "East",
  "Southeast",
  "South",
  "Southwest",
  "West",
  "Northwest",
];

const exportHeaders = [
  "date",
  "time",
  "rollName",
  "frameNumber",
  "iso",
  "filmType",
  "direction",
  "cloudLabel",
  "place",
  "apertureUsed",
  "shutterUsed",
  "recommendedAperture",
  "recommendedShutter",
  "notes",
];

const els = {
  timeNow: document.querySelector("#timeNow"),
  placeNow: document.querySelector("#placeNow"),
  cloudNow: document.querySelector("#cloudNow"),
  weatherSource: document.querySelector("#weatherSource"),
  form: document.querySelector("#frameForm"),
  rollName: document.querySelector("#rollName"),
  frameNumber: document.querySelector("#frameNumber"),
  direction: document.querySelector("#direction"),
  cloudCover: document.querySelector("#cloudCover"),
  apertureUsed: document.querySelector("#apertureUsed"),
  shutterUsed: document.querySelector("#shutterUsed"),
  notes: document.querySelector("#notes"),
  recommendedAperture: document.querySelector("#recommendedAperture"),
  recommendedShutter: document.querySelector("#recommendedShutter"),
  recommendationReason: document.querySelector("#recommendationReason"),
  quickOptions: document.querySelector("#quickOptions"),
  frameLog: document.querySelector("#frameLog"),
  emptyState: document.querySelector("#emptyState"),
  exportExcel: document.querySelector("#exportExcel"),
  exportCsv: document.querySelector("#exportCsv"),
  refreshConditions: document.querySelector("#refreshConditions"),
  recommendButton: document.querySelector("#recommendButton"),
  useCompass: document.querySelector("#useCompass"),
  compassStatus: document.querySelector("#compassStatus"),
  versionStamp: document.querySelector("#versionStamp"),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function currentTime24(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function updateClock() {
  els.timeNow.textContent = currentTime24();
}

function cloudLabel(value) {
  const number = Number(value);
  if (number < 15) return "Clear";
  if (number < 40) return "Mostly clear";
  if (number < 65) return "Partly cloudy";
  if (number < 90) return "Mostly cloudy";
  return "Overcast";
}

function headingToDirection(degrees) {
  const index = Math.round(normalizeAngle(degrees) / 45) % 8;
  return degreeDirections[index];
}

function weatherSourceLabel() {
  if (!state.weatherUpdatedAt) return "Manual";
  return `Open-Meteo ${currentTime24(state.weatherUpdatedAt)}`;
}

function normalizeAngle(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function angleDifference(a, b) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, 360 - diff);
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function solarPosition(date, latitude, longitude) {
  if (latitude === null || longitude === null) {
    return fallbackSolarPosition(date);
  }

  const rad = Math.PI / 180;
  const day = dayOfYear(date);
  const hour = date.getHours() + date.getMinutes() / 60;
  const gamma = (2 * Math.PI / 365) * (day - 1 + (hour - 12) / 24);
  const equation =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const offset = equation + 4 * longitude + date.getTimezoneOffset();
  const trueSolarMinutes = hour * 60 + offset;
  const hourAngle = (trueSolarMinutes / 4 - 180) * rad;
  const latRad = latitude * rad;
  const altitude = Math.asin(
    Math.sin(latRad) * Math.sin(declination) +
      Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle),
  );
  const azimuth =
    Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(declination) * Math.cos(latRad),
    ) /
      rad +
    180;

  return { altitude: altitude / rad, azimuth: normalizeAngle(azimuth), estimated: false };
}

function fallbackSolarPosition(date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  let altitude = 45;
  const azimuth = normalizeAngle(90 + (hour - 6) * 15);

  if (hour < 5 || hour >= 21) {
    altitude = -12;
  } else if (hour < 7) {
    altitude = -4 + (hour - 5) * 7;
  } else if (hour < 10) {
    altitude = 10 + (hour - 7) * 10;
  } else if (hour < 15) {
    altitude = 42;
  } else if (hour < 18) {
    altitude = 42 - (hour - 15) * 10;
  } else {
    altitude = 12 - (hour - 18) * 8;
  }

  return { altitude, azimuth, estimated: true };
}

function exposureAdjustment({ cloudCover, direction, date }) {
  const cloud = Number(cloudCover);
  let stops = 0;
  const reasons = [];

  if (cloud >= 90) {
    stops += 4;
    reasons.push("overcast light");
  } else if (cloud >= 65) {
    stops += 3;
    reasons.push("mostly cloudy light");
  } else if (cloud >= 40) {
    stops += 2;
    reasons.push("partly cloudy light");
  } else if (cloud >= 15) {
    stops += 1;
    reasons.push("light cloud cover");
  }

  const sun = solarPosition(date, state.latitude, state.longitude);
  if (sun.estimated) {
    reasons.push("time-based light estimate");
  }

  if (sun.altitude < -4) {
    stops += 10;
    reasons.push("after dark or very low light");
  } else if (sun.altitude < 6) {
    stops += 5;
    reasons.push("twilight or sunrise/sunset");
  } else if (sun.altitude < 18) {
    stops += 2;
    reasons.push("low sun");
  }

  const facing = directionDegrees[direction] ?? 0;
  const sunDiff = angleDifference(facing, sun.azimuth);
  if (sun.altitude > 0 && cloud < 80) {
    if (sunDiff <= 45) {
      stops -= 0.5;
      reasons.push("facing toward the sun");
    } else if (sunDiff >= 135) {
      stops += 1;
      reasons.push("backlit subject");
    }
  }

  return { stops: Math.max(-1, Math.min(7, stops)), reasons, sun };
}

function settingsForEv(ev) {
  const candidates = [];
  for (const aperture of apertures) {
    for (const shutter of shutters) {
      const candidateEv = Math.log2((aperture * aperture) / shutter.value);
      candidates.push({
        aperture,
        shutter,
        score: Math.abs(candidateEv - ev) + (shutter.value < 1 / 60 ? 0.35 : 0),
      });
    }
  }
  return candidates.sort((a, b) => a.score - b.score);
}

function calculateRecommendation() {
  const date = new Date();
  const cloudCover = Number(els.cloudCover.value);
  const direction = els.direction.value;
  const adjustment = exposureAdjustment({ cloudCover, direction, date });
  const sunny16EvAtIso = 15 + Math.log2(state.iso / 100);
  const targetEv = sunny16EvAtIso - adjustment.stops;
  const options = settingsForEv(targetEv).slice(0, 5);
  const preferred = options.find((option) => option.shutter.value >= 1 / 60) || options[0];

  state.recommendation = {
    iso: state.iso,
    filmType: state.filmType,
    aperture: `f/${preferred.aperture}`,
    shutter: preferred.shutter.label,
    cloudCover,
    direction,
    time: currentTime24(date),
    latitude: state.latitude,
    longitude: state.longitude,
    place: state.place,
    sunAltitude: Math.round(adjustment.sun.altitude),
    sunAzimuth: Math.round(adjustment.sun.azimuth),
    reasons: adjustment.reasons,
    options: options.map((option) => ({ aperture: `f/${option.aperture}`, shutter: option.shutter.label })),
  };

  renderRecommendation();
}

function renderRecommendation() {
  const rec = state.recommendation;
  if (!rec) return;

  els.recommendedAperture.textContent = rec.aperture;
  els.recommendedShutter.textContent = rec.shutter;
  const reason = rec.reasons.length ? rec.reasons.join(", ") : "bright direct daylight";
  const estimateNote = rec.latitude === null || rec.longitude === null ? " Allow location for a more accurate sun angle." : "";
  const supportNote = shutterNeedsSupport(rec.shutter) ? " Use a tripod, flash, or intentional motion blur at this speed." : "";
  els.recommendationReason.textContent = `ISO ${rec.iso} ${rec.filmType.toLowerCase()}, ${cloudLabel(rec.cloudCover).toLowerCase()}, ${reason}. Sun angle ${rec.sunAltitude}°, azimuth ${rec.sunAzimuth}°.${supportNote}${estimateNote}`;

  els.quickOptions.innerHTML = "";
  rec.options.forEach((option) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "option-chip";
    chip.textContent = `${option.aperture} · ${option.shutter}`;
    chip.addEventListener("click", () => {
      els.apertureUsed.value = option.aperture;
      els.shutterUsed.value = option.shutter;
    });
    els.quickOptions.appendChild(chip);
  });
}

function shutterNeedsSupport(shutterLabel) {
  if (shutterLabel === "Program") return false;
  if (shutterLabel === "1") return true;
  const denominator = Number(shutterLabel.split("/")[1]);
  return denominator < 60;
}

function renderStatus() {
  els.placeNow.textContent = state.place;
  els.cloudNow.textContent = state.weatherCloudCover === null ? cloudLabel(els.cloudCover.value) : `${cloudLabel(state.weatherCloudCover)} ${state.weatherCloudCover}%`;
  els.weatherSource.textContent = weatherSourceLabel();
}

function renderFrames() {
  els.frameLog.innerHTML = "";
  els.emptyState.hidden = state.frames.length > 0;

  state.frames
    .slice()
    .reverse()
    .forEach((frame) => {
      const item = document.createElement("article");
      item.className = "frame-card";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(frame.rollName)} #${frame.frameNumber}</strong>
          <span>${frame.date} ${frame.time} · ISO ${frame.iso} · ${escapeHtml(frame.filmType)}</span>
        </div>
        <dl>
          <div><dt>Used</dt><dd>${escapeHtml(frame.apertureUsed)} at ${escapeHtml(frame.shutterUsed)}</dd></div>
          <div><dt>Suggested</dt><dd>${escapeHtml(frame.recommendedAperture)} at ${escapeHtml(frame.recommendedShutter)}</dd></div>
          <div><dt>Conditions</dt><dd>${escapeHtml(frame.direction)}, ${escapeHtml(frame.cloudLabel)}, ${escapeHtml(frame.place)}</dd></div>
        </dl>
        ${frame.notes ? `<p>${escapeHtml(frame.notes)}</p>` : ""}
      `;
      els.frameLog.appendChild(item);
    });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

async function refreshConditions() {
  els.placeNow.textContent = "Locating";
  if (!navigator.geolocation) {
    state.place = "Manual";
    state.weatherCloudCover = null;
    state.weatherUpdatedAt = null;
    renderStatus();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      state.latitude = position.coords.latitude;
      state.longitude = position.coords.longitude;
      state.place = `${state.latitude.toFixed(3)}, ${state.longitude.toFixed(3)}`;

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${state.latitude}&longitude=${state.longitude}&current=cloud_cover,temperature_2m,weather_code&timezone=auto`;
        const response = await fetch(url);
        const data = await response.json();
        if (typeof data.current?.cloud_cover === "number") {
          state.weatherCloudCover = data.current.cloud_cover;
          state.weatherUpdatedAt = data.current.time ? new Date(data.current.time) : new Date();
          els.cloudCover.value = String(nearestCloudOption(state.weatherCloudCover));
        }
      } catch {
        state.weatherCloudCover = null;
        state.weatherUpdatedAt = null;
      }

      renderStatus();
      calculateRecommendation();
    },
    () => {
      state.place = "Manual";
      state.weatherCloudCover = null;
      state.weatherUpdatedAt = null;
      renderStatus();
      calculateRecommendation();
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
  );
}

async function useCompassHeading() {
  if (!window.DeviceOrientationEvent) {
    els.compassStatus.textContent = "Compass is not available in this browser.";
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        els.compassStatus.textContent = "Compass permission was not granted.";
        return;
      }
    } catch {
      els.compassStatus.textContent = "Compass permission could not be requested.";
      return;
    }
  }

  els.compassStatus.textContent = "Point your phone, then hold still.";

  const handleOrientation = (event) => {
    const heading =
      typeof event.webkitCompassHeading === "number"
        ? event.webkitCompassHeading
        : typeof event.alpha === "number"
          ? 360 - event.alpha
          : null;

    if (heading === null) {
      els.compassStatus.textContent = "Compass heading is unavailable.";
      return;
    }

    const direction = headingToDirection(heading);
    els.direction.value = direction;
    els.compassStatus.textContent = `${Math.round(heading)}° ${direction}`;
    renderStatus();
    calculateRecommendation();
    window.removeEventListener("deviceorientation", handleOrientation);
  };

  window.addEventListener("deviceorientation", handleOrientation, { once: true });
}

function nearestCloudOption(value) {
  return [0, 25, 50, 75, 100].reduce((best, option) => {
    return Math.abs(option - value) < Math.abs(best - value) ? option : best;
  }, 0);
}

function saveFrame(event) {
  event.preventDefault();
  calculateRecommendation();
  const rec = state.recommendation;
  const now = new Date();
  const frame = {
    id: crypto.randomUUID(),
    date: now.toISOString().slice(0, 10),
    time: currentTime24(now),
    rollName: els.rollName.value.trim() || "Roll",
    frameNumber: Number(els.frameNumber.value) || 1,
    iso: state.iso,
    filmType: state.filmType,
    direction: els.direction.value,
    cloudCover: Number(els.cloudCover.value),
    cloudLabel: cloudLabel(els.cloudCover.value),
    place: state.place,
    latitude: state.latitude,
    longitude: state.longitude,
    apertureUsed: els.apertureUsed.value,
    shutterUsed: els.shutterUsed.value,
    recommendedAperture: rec.aperture,
    recommendedShutter: rec.shutter,
    notes: els.notes.value.trim(),
  };

  state.frames.push(frame);
  localStorage.setItem("frame-notes", JSON.stringify(state.frames));
  els.frameNumber.value = String(frame.frameNumber + 1);
  els.notes.value = "";
  renderFrames();
}

function exportCsv() {
  const rows = [exportHeaders.join(",")].concat(
    state.frames.map((frame) =>
      exportHeaders
        .map((header) => {
          const value = String(frame[header] ?? "");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "frame-notes.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportExcel() {
  const headerCells = exportHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const rows = state.frames
    .map((frame) => {
      const cells = exportHeaders
        .map((header) => `<td>${escapeHtml(frame[header] ?? "")}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const workbook = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; }
      th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
      th { background: #d9ead3; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "frame-notes.xls";
  link.click();
  URL.revokeObjectURL(link.href);
}

function setupSegmentedControls() {
  document.querySelectorAll(".segmented").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      group.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      if (group.dataset.field === "iso") state.iso = Number(button.dataset.value);
      if (group.dataset.field === "filmType") state.filmType = button.dataset.value;
      calculateRecommendation();
    });
  });
}

function bindEvents() {
  els.form.addEventListener("submit", saveFrame);
  els.exportExcel.addEventListener("click", exportExcel);
  els.exportCsv.addEventListener("click", exportCsv);
  els.refreshConditions.addEventListener("click", refreshConditions);
  els.recommendButton.addEventListener("click", calculateRecommendation);
  els.useCompass.addEventListener("click", useCompassHeading);
  els.direction.addEventListener("change", () => {
    renderStatus();
    calculateRecommendation();
  });
  els.cloudCover.addEventListener("change", () => {
    state.weatherCloudCover = null;
    renderStatus();
    calculateRecommendation();
  });
}

function renderVersion() {
  els.versionStamp.textContent = `${APP_VERSION} · updated ${APP_UPDATED_AT}`;
}

setupSegmentedControls();
bindEvents();
renderVersion();
updateClock();
setInterval(updateClock, 10000);
renderStatus();
calculateRecommendation();
renderFrames();
refreshConditions();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
