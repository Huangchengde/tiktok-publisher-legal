(() => {
  "use strict";

  const API_BASE = "https://tiktok-content-api.onrender.com";
  const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024;
  const SUPPORTED_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
  const CHUNK_SIZE = 10 * 1024 * 1024;

  const elements = {
    fileInput: document.querySelector("#videoFile"),
    dropZone: document.querySelector("#dropZone"),
    fileSummary: document.querySelector("#fileSummary"),
    videoPreview: document.querySelector("#videoPreview"),
    fileName: document.querySelector("#fileName"),
    fileSize: document.querySelector("#fileSize"),
    fileDuration: document.querySelector("#fileDuration"),
    fileFrame: document.querySelector("#fileFrame"),
    replaceVideo: document.querySelector("#replaceVideo"),
    postForm: document.querySelector("#postForm"),
    caption: document.querySelector("#caption"),
    captionCount: document.querySelector("#captionCount"),
    privacyLevel: document.querySelector("#privacyLevel"),
    coverTimestamp: document.querySelector("#coverTimestamp"),
    allowComment: document.querySelector("#allowComment"),
    allowDuet: document.querySelector("#allowDuet"),
    allowStitch: document.querySelector("#allowStitch"),
    isAigc: document.querySelector("#isAigc"),
    validateButton: document.querySelector("#validateButton"),
    checkVideo: document.querySelector("#checkVideo"),
    checkCaption: document.querySelector("#checkCaption"),
    checkValidation: document.querySelector("#checkValidation"),
    statusBox: document.querySelector("#statusBox"),
  };

  let selectedFile = null;
  let objectUrl = null;

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
  };

  const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds)) return "Reading…";
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remaining}`;
  };

  const setStatus = (title, message, type = "") => {
    elements.statusBox.className = `status-box${type ? ` ${type}` : ""}`;
    elements.statusBox.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = title;
    elements.statusBox.append(strong, document.createTextNode(message));
  };

  const syncChecklist = () => {
    elements.checkVideo.classList.toggle("done", Boolean(selectedFile));
    elements.checkCaption.classList.toggle("done", elements.caption.value.trim().length > 0);
    elements.validateButton.disabled = !(selectedFile && elements.caption.value.trim());
  };

  const resetValidation = () => {
    elements.checkValidation.classList.remove("done");
    if (selectedFile) setStatus("Ready for review", "Complete the caption and run the publication check.");
  };

  const loadFile = (file) => {
    if (!file) return;
    if (!SUPPORTED_TYPES.has(file.type)) {
      setStatus("Unsupported file", "Choose an MP4, MOV, or WebM video.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus("File is too large", "Choose a video smaller than 4 GB.", "error");
      return;
    }

    selectedFile = file;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    elements.videoPreview.src = objectUrl;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatBytes(file.size);
    elements.fileDuration.textContent = "Reading…";
    elements.fileFrame.textContent = "Reading…";
    elements.dropZone.hidden = true;
    elements.fileSummary.classList.add("visible");
    resetValidation();
    syncChecklist();
  };

  elements.videoPreview.addEventListener("loadedmetadata", () => {
    elements.fileDuration.textContent = formatDuration(elements.videoPreview.duration);
    elements.fileFrame.textContent = `${elements.videoPreview.videoWidth} × ${elements.videoPreview.videoHeight}`;
  });

  elements.fileInput.addEventListener("change", (event) => loadFile(event.target.files[0]));
  elements.replaceVideo.addEventListener("click", () => elements.fileInput.click());

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("dragover");
    });
  });
  elements.dropZone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));

  elements.caption.addEventListener("input", () => {
    elements.captionCount.textContent = elements.caption.value.length;
    resetValidation();
    syncChecklist();
  });
  [elements.privacyLevel, elements.coverTimestamp, elements.allowComment, elements.allowDuet, elements.allowStitch, elements.isAigc]
    .forEach((element) => element.addEventListener("change", resetValidation));

  elements.postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedFile || !elements.caption.value.trim()) return;

    const chunkSize = Math.min(CHUNK_SIZE, selectedFile.size);
    const payload = {
      title: elements.caption.value.trim(),
      privacy_level: elements.privacyLevel.value,
      disable_duet: !elements.allowDuet.checked,
      disable_comment: !elements.allowComment.checked,
      disable_stitch: !elements.allowStitch.checked,
      video_size: selectedFile.size,
      chunk_size: chunkSize,
      total_chunk_count: Math.ceil(selectedFile.size / chunkSize),
      video_cover_timestamp_ms: Math.max(0, Math.round(Number(elements.coverTimestamp.value || 0) * 1000)),
      is_aigc: elements.isAigc.checked,
    };

    elements.validateButton.disabled = true;
    setStatus("Checking publication settings", "Validating metadata with the KnowGrow publishing service…");
    try {
      const response = await fetch(`${API_BASE}/tiktok/publish/dry-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.detail || "The publication check failed.");
      elements.checkValidation.classList.add("done");
      const warning = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
      setStatus("Publication check passed", `Your video metadata and settings are ready. Connect your TikTok account to continue.${warning}`, "success");
    } catch (error) {
      setStatus("Publication check unavailable", `${error.message} Please try again or visit Support.`, "error");
    } finally {
      syncChecklist();
    }
  });

  fetch(`${API_BASE}/healthz`, { mode: "cors" }).catch(() => {
    setStatus("Service connection unavailable", "The preparation service could not be reached. You can still preview your local video.", "error");
  });

  window.addEventListener("beforeunload", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
  syncChecklist();
})();
