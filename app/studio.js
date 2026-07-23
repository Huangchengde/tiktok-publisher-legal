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
    connectButton: document.querySelector("#connectButton"),
    creatorButton: document.querySelector("#creatorButton"),
    uploadButton: document.querySelector("#uploadButton"),
    publishButton: document.querySelector("#publishButton"),
    checkVideo: document.querySelector("#checkVideo"),
    checkCaption: document.querySelector("#checkCaption"),
    checkValidation: document.querySelector("#checkValidation"),
    statusBox: document.querySelector("#statusBox"),
  };

  let selectedFile = null;
  let objectUrl = null;
  let publicationChecked = false;
  let creatorReady = false;

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

  const uploadPlan = (videoSize) => {
    const chunkSize = Math.min(CHUNK_SIZE, videoSize);
    return {
      videoSize,
      chunkSize,
      totalChunkCount: Math.max(1, Math.floor(videoSize / chunkSize)),
    };
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
    publicationChecked = false;
    elements.checkValidation.classList.remove("done");
    elements.uploadButton.disabled = true;
    elements.publishButton.disabled = true;
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

    const plan = uploadPlan(selectedFile.size);
    const payload = {
      title: elements.caption.value.trim(),
      privacy_level: elements.privacyLevel.value,
      disable_duet: !elements.allowDuet.checked,
      disable_comment: !elements.allowComment.checked,
      disable_stitch: !elements.allowStitch.checked,
      video_size: plan.videoSize,
      chunk_size: plan.chunkSize,
      total_chunk_count: plan.totalChunkCount,
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
      publicationChecked = true;
      elements.uploadButton.disabled = !creatorReady;
      elements.publishButton.disabled = !creatorReady;
      const warning = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
      setStatus("Publication check passed", `Your video metadata and settings are ready. Connect your TikTok account to continue.${warning}`, "success");
    } catch (error) {
      setStatus("Publication check unavailable", `${error.message} Please try again or visit Support.`, "error");
    } finally {
      syncChecklist();
    }
  });

  const requestJson = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const result = await response.json();
    if (!response.ok || (result.error?.code && result.error.code !== "ok")) {
      const detail = typeof result.detail === "string" ? result.detail : "";
      const apiMessage = typeof result.error?.message === "string" ? result.error.message : "";
      throw new Error(detail || apiMessage || "TikTok API request failed.");
    }
    return result;
  };

  const sourceInfo = () => {
    const plan = uploadPlan(selectedFile.size);
    return {
      source: "FILE_UPLOAD",
      video_size: plan.videoSize,
      chunk_size: plan.chunkSize,
      total_chunk_count: plan.totalChunkCount,
    };
  };

  const uploadChunks = async (uploadUrl) => {
    const plan = uploadPlan(selectedFile.size);
    let start = 0;
    for (let chunkIndex = 0; chunkIndex < plan.totalChunkCount; chunkIndex += 1) {
      const isLastChunk = chunkIndex === plan.totalChunkCount - 1;
      const end = isLastChunk ? selectedFile.size : start + plan.chunkSize;
      const chunk = selectedFile.slice(start, end, selectedFile.type || "video/mp4");
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "video/mp4",
          "Content-Length": String(chunk.size),
          "Content-Range": `bytes ${start}-${end - 1}/${selectedFile.size}`,
        },
        body: chunk,
      });
      if (!response.ok) throw new Error(`Video transfer failed (${response.status}).`);
      start = end;
    }
  };

  const pollStatus = async (publishId) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await requestJson("/tiktok/publish/status/fetch", {
        method: "POST",
        body: JSON.stringify({ publish_id: publishId }),
      });
      const status = result.data?.status || "PROCESSING";
      setStatus("TikTok is processing the video", `Publish ID: ${publishId} · Status: ${status}`);
      if (!["PROCESSING", "SEND_TO_USER_INBOX"].includes(status)) return status;
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    return "PROCESSING";
  };

  elements.creatorButton.addEventListener("click", async () => {
    setStatus("Reading creator information", "Querying the authorized TikTok account and available publishing settings…");
    try {
      const result = await requestJson("/tiktok/creator-info");
      const creator = result.data || {};
      creatorReady = true;
      elements.uploadButton.disabled = !publicationChecked;
      elements.publishButton.disabled = !publicationChecked;
      setStatus(
        "Creator information received",
        `${creator.creator_nickname || "Authorized creator"} · Publishing settings are available.`,
        "success",
      );
    } catch (error) {
      setStatus("Creator information unavailable", error.message, "error");
    }
  });

  const sendVideo = async (mode) => {
    if (!selectedFile || !publicationChecked || !creatorReady) return;
    const isDraft = mode === "draft";
    const initPath = isDraft ? "/tiktok/upload/video/init" : "/tiktok/publish/video/init";
    const payload = isDraft
      ? { source_info: sourceInfo() }
      : {
          post_info: {
            title: elements.caption.value.trim(),
            privacy_level: elements.privacyLevel.value,
            disable_duet: !elements.allowDuet.checked,
            disable_comment: !elements.allowComment.checked,
            disable_stitch: !elements.allowStitch.checked,
            video_cover_timestamp_ms: Math.max(0, Math.round(Number(elements.coverTimestamp.value || 0) * 1000)),
            is_aigc: elements.isAigc.checked,
          },
          source_info: sourceInfo(),
        };

    elements.uploadButton.disabled = true;
    elements.publishButton.disabled = true;
    setStatus(isDraft ? "Initializing TikTok draft upload" : "Initializing TikTok direct post", "Requesting a secure upload URL…");
    try {
      const result = await requestJson(initPath, { method: "POST", body: JSON.stringify(payload) });
      const uploadUrl = result.data?.upload_url;
      const publishId = result.data?.publish_id;
      if (!uploadUrl || !publishId) throw new Error("TikTok did not return an upload URL.");
      setStatus("Uploading video to TikTok", `Publish ID: ${publishId}`);
      await uploadChunks(uploadUrl);
      const finalStatus = await pollStatus(publishId);
      setStatus(
        isDraft ? "TikTok draft upload completed" : "TikTok publication submitted",
        `Publish ID: ${publishId} · Status: ${finalStatus}`,
        "success",
      );
    } catch (error) {
      setStatus(isDraft ? "Draft upload failed" : "Publication failed", error.message, "error");
    } finally {
      elements.uploadButton.disabled = !publicationChecked || !creatorReady;
      elements.publishButton.disabled = !publicationChecked || !creatorReady;
    }
  };

  elements.uploadButton.addEventListener("click", () => sendVideo("draft"));
  elements.publishButton.addEventListener("click", () => sendVideo("publish"));

  if (new URLSearchParams(window.location.search).get("connected") === "1") {
    elements.connectButton.hidden = true;
    elements.creatorButton.hidden = false;
    elements.uploadButton.hidden = false;
    elements.publishButton.hidden = false;
    elements.uploadButton.disabled = true;
    elements.publishButton.disabled = true;
    setStatus("TikTok account connected", "Read creator information, then upload a draft or publish after the publication check.", "success");
    window.history.replaceState({}, "", window.location.pathname);
  }

  fetch(`${API_BASE}/healthz`, { mode: "cors" }).catch(() => {
    setStatus("Service connection unavailable", "The preparation service could not be reached. You can still preview your local video.", "error");
  });

  window.addEventListener("beforeunload", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
  syncChecklist();
})();
