const BASE = "https://one.beezlebug.com/sprachbot";

const logEl = document.getElementById("log");
const log = (...a) => (logEl.textContent += a.join(" ") + "\n");

const API = {
  async stt(file) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    let url = BASE + "/stt.php";
    const res = await fetch((url), { method: "POST", body: fd });
    const txt = await res.text();
    return JSON.stringify(txt) ? JSON.parse(txt) : txt;
  },

  async llm(question) {
    const fd = new FormData();
    fd.append("message", question);
    let url = BASE + "/llm.php";
    const res = await fetch((url), { method: "POST", body: fd });
    const txt = await res.text();
    return JSON.stringify(txt) ? JSON.parse(txt) : txt;
  },

  async tts(text) {
    const fd = new FormData();
    fd.append("text", text);
    let url = BASE + "/tts.php";
    const res = await fetch((url), { method: "POST", body: fd });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    log("TTS Content-Type:", ct);
    if (ct.includes("application/json")) {
      const j = await res.json();
      return {
        ok: res.ok && !!j.audio_data_url,
        src: j.audio_data_url || "",
        format: j.format || "wav",
        size: j.size_bytes ?? null,
        raw: j,
        status: res.status
      };
    }
    if (ct.startsWith("audio/")) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return {
        ok: res.ok,
        src: url,
        format: ct.includes("mpeg") ? "mp3" : "wav",
        size: blob.size,
        blob,
        status: res.status
      };
    }
    const errTxt = await res.text();
    return { ok: false, error: `unexpected content-type: ${ct}`, raw: errTxt, status: res.status };
  }
};

async function sendSTT() {
  console.log("STT gestartet");
  const file = document.getElementById("file").files?.[0];
  if (!file) return alert("Bitte eine Audiodatei wählen.");
  try {
    const response = await API.stt(file);
    let transcriptEl = document.getElementById("transcription");
    transcriptEl.value = response.transcription || response.text || "";
    log("STT →", JSON.stringify(response, null, 2));
  } catch (e) {
    console.error(e);
    log("STT Fehler:", String(e));
  }
}

async function sendLLM() {
  console.log("LLM gestartet");
  const question = document.getElementById("question").value.trim();
  if (!question) return alert("Bitte eine Frage eingeben.");
  try {
    const response = await API.llm(question);
    const answerEl = document.getElementById("answer");
    answerEl.value = response.reply;
    log("LLM →", JSON.stringify(response, null, 2));
  } catch (e) {
    console.error(e);
    log("LLM Fehler:", String(e));
  }
}

async function sendTTS() {
  console.log("TTS gestartet");
  const text = document.getElementById("tts-text").value.trim();
  if (!text) return alert("Bitte eine Antwort zum Vorlesen eingeben.");
  try {
    const response = await API.tts(text);
    //log("TTS →", JSON.stringify(response, null, 2));
    if (response.ok && response.src) {
      const audio = new Audio(response.src);
      //audio.play().catch((e) => log("TTS Play Fehler:", String(e)));
      const player = document.getElementById("ttsPlayer");
      player.style.display = "block";
      player.src = response.src;
      const info = document.getElementById("ttsInfo");
      audio.play().catch((e) => log("TTS Play Fehler:", String(e)));
      info.textContent = `Format: ${response.format.toUpperCase()} - Größe: ${response.size ? response.size + " Bytes" : "unbekannt"}`;
      log("TTS abgespielt");
    } else {
      log("TTS Fehler:", response.error || "Unbekannter Fehler");
    }
  } catch (e) {
    console.error(e);
    log("TTS Fehler:", String(e));
  }
}

function clearAll() {
  document.getElementById("transcription").value = "";
  document.getElementById("question").value = "";
  document.getElementById("answer").value = "";
  document.getElementById("tts-text").value = "";
  document.getElementById("ttsPlayer").style.display = "none";
  document.getElementById("ttsPlayer").src = "";
  document.getElementById("ttsInfo").textContent = "";
  logEl.textContent = "";
}

/* ========== Buttons (nutzen nur die API, alles returned) ========== */
document.getElementById("stt-button").addEventListener("click", sendSTT);

document.getElementById("ask").addEventListener("click", sendLLM);

document.getElementById("tts").addEventListener("click", sendTTS);

document.getElementById("pipeline-start").addEventListener("click", async () => {
  console.log("Pipeline gestartet");
  await sendSTT();
  let transcription = document.getElementById("transcription").value.trim();
  document.getElementById("question").value = transcription;

  await sendLLM();
  let answer = document.getElementById("answer").value.trim();
  document.getElementById("tts-text").value = answer;

  await sendTTS();
});


const fileInput = document.getElementById("file");
  const inputPlayer = document.getElementById("inputPlayer");
  const inputInfo = document.getElementById("inputInfo");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    inputPlayer.src = url;
    inputPlayer.load();
    inputPlayer.play().catch(() => {
      // Autoplay könnte geblockt sein, deswegen kein Fehler werfen
    });

    // Zusatzinfo anzeigen
    inputInfo.textContent = `Datei: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  });
