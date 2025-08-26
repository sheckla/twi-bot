// ===== Config =====
const API_URL = "https://one.beezlebug.com/sprachbot";


// AI-Pipeline Helper Class
class API {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || API_URL;
  }

  async stt(file) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    const url = this.apiUrl + "/stt.php";
    const res = await fetch(url, { method: "POST", body: fd });
    const txt = await res.text();
    return JSON.stringify(txt) ? JSON.parse(txt) : txt;
  }

  async llm(question) {
    const fd = new FormData();
    fd.append("message", question);
    const url = this.apiUrl + "/llm.php";
    const res = await fetch(url, { method: "POST", body: fd });
    const txt = await res.text();
    return JSON.stringify(txt) ? JSON.parse(txt) : txt;
  }

  async tts(text) {
    const fd = new FormData();
    fd.append("text", text);
    const url = this.apiUrl + "/tts.php";
    const res = await fetch(url, { method: "POST", body: fd });
    const txt = await res.text();
    return JSON.stringify(txt) ? JSON.parse(txt) : txt;
  }
}

const api = new API(API_URL);

async function sendSTT() {
  const file = document.getElementById("file").files?.[0];
  if (!file) return alert("Bitte eine Audiodatei wählen.");
  let start = Date.now();
  try {
    const response = await api.stt(file);
    let transcriptEl = document.getElementById("transcription");
    transcriptEl.textContent = response.transcription;
    let successEl = document.getElementById("stt-success");
    successEl.classList.remove("hidden");
    let ms = (Date.now() - start);
    let transcriptMsEl = document.getElementById("transcription-ms-server");
    let transcriptNetMsEl = document.getElementById("transcription-ms-network");
    let transcriptTotalMsEl = document.getElementById("transcription-ms-total");
    let mss = { server: 0, network: 0, total: 0 };
    mss.network = Math.round(ms - response.ms);
    mss.server = Math.round(response.ms);
    transcriptMsEl.textContent = mss.server + " ms";
    transcriptNetMsEl.textContent = mss.network + " ms";
    mss.total = Math.round(mss.server + mss.network);
    transcriptTotalMsEl.textContent = mss.total + " ms";
    return mss;
  } catch (e) {
    console.error(e);
  }
}

async function sendLLM() {
  const question = document.getElementById("question").value.trim();
  if (!question) return alert("Bitte eine Frage eingeben.");
  let start = Date.now();
  try {
    const response = await api.llm(question);
    const answerEl = document.getElementById("answer");
    answerEl.textContent = response.reply;
    let successEl = document.getElementById("llm-success");
    successEl.classList.remove("hidden");
    let ms = (Date.now() - start);
    let llmMsEl = document.getElementById("llm-ms-server");
    let llmNetMsEl = document.getElementById("llm-ms-network");
    let llmTotalMsEl = document.getElementById("llm-ms-total");
    let mss = { server: 0, network: 0, total: 0 };
    mss.network = Math.round(ms - response.ms);
    mss.server = Math.round(response.ms);
    llmMsEl.textContent = mss.server + " ms";
    llmNetMsEl.textContent = mss.network + " ms";
    mss.total = Math.round(mss.server + mss.network);
    llmTotalMsEl.textContent = mss.total + " ms";
    return mss;
  } catch (e) {
    console.error(e);
  }
}

async function sendTTS() {
  const text = document.getElementById("tts-text").value.trim();
  if (!text) return alert("Bitte eine Antwort zum Vorlesen eingeben.");
  const start = Date.now();
  try {
    const response = await api.tts(text);

    if (response && response.ok && response.audio_data_url) {
      const player = document.getElementById("ttsPlayer");
      player.style.display = "block";
      player.src = response.audio_data_url;

      // direkt abspielen (Autoplay kann blocken)
      player.play().catch(() => {});

      const info = document.getElementById("ttsInfo");
      const fmt  = (response.format || "wav").toUpperCase();
      const size = response.size_bytes ? `${response.size_bytes} Bytes` : "unbekannt";
      info.textContent = `Format: ${fmt} - Größe: ${size}`;

      const msClient = Date.now() - start;
      const mss = { server: Math.round(response.ms || 0) };
      mss.network = Math.max(0, Math.round(msClient - mss.server));
      mss.total   = mss.server + mss.network;

      document.getElementById("tts-success").classList.remove("hidden");
      document.getElementById("tts-ms-server").textContent  = `${mss.server} ms`;
      document.getElementById("tts-ms-network").textContent = `${mss.network} ms`;
      //document.getElementById("tts-ms-total").textContent   = `${mss.total} ms`;

      //totals.tts = mss;
      return mss;
    }
  } catch (e) {
    console.error(e);
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
  document.getElementById("stt-success").classList.add("hidden");
  document.getElementById("llm-success").classList.add("hidden");
  document.getElementById("tts-success").classList.add("hidden");
  document.getElementById("final-success").classList.add("hidden");
}

document.getElementById("stt-button").addEventListener("click", sendSTT);
document.getElementById("ask").addEventListener("click", sendLLM);
document.getElementById("tts").addEventListener("click", sendTTS);
document.getElementById("pipeline-start").addEventListener("click", async () => {
  clearAll();
  let loadingEl = document.getElementById("loading");
  loadingEl.classList.remove("hidden");
  let times = [];
  let ms = await sendSTT();
  times.push(ms)
  let transcription = document.getElementById("transcription").textContent.trim();
  document.getElementById("question").value = transcription;

  ms = await sendLLM();
  times.push(ms);
  let answer = document.getElementById("answer").textContent.trim();
  document.getElementById("tts-text").value = answer;

  ms = await sendTTS();
  times.push(ms);

  let msTotal = 0;
  times.forEach(element => {
    msTotal += element.total
  });

  let msServerTotal = 0;
  times.forEach(element => {
    msServerTotal += element.server
  });

  let msNetworkTotal = 0;
  times.forEach(element => {
    msNetworkTotal += element.network
  });

  let finalMs = { server: msServerTotal, network: msNetworkTotal, total: msTotal };
  appendTimes("total", finalMs);
  let finalEl = document.getElementById("final-success");
  finalEl.classList.remove("hidden");
  loadingEl.classList.add("hidden");
});

function appendTimes(id, mss) {
  if (!mss) return;
  document.getElementById(id + "-ms-server").textContent  = `${mss.server} ms`;
  document.getElementById(id + "-ms-network").textContent = `${mss.network} ms`;
  document.getElementById(id + "-ms-total").textContent   = `${mss.total} ms`;
}


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
  inputInfo.textContent = `Datei: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
});
