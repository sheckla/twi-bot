// ===== Config =====
const API_URL = "https://one.beezlebug.com/sprachbot";

// ===== Basic Variables =====
const canvas = document.getElementById("visualizer");
const canvasCtx = canvas?.getContext("2d");
const fileInput = document.getElementById("file");
const fileInputPlayer = document.getElementById("inputPlayer");
const pttButton = document.getElementById('push-to-talk-begin')
let recorderStream = null, recorder = null, recorderChunks = [], micIsRecording = false;
let timer = 0;

let animationFrameId = null;
let pttStartTime = 0;

function formatMs(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');
  return `${mm}:${ss}.${mmm}`;
}


/* ===== Beezlebug API Class =====
* - Handles all API requests to the Beezlebug backend
* - Manages conversation state for LLM
*/
class BeezlebugApi {
  conversation = "";

  constructor(apiUrl) {
    this.apiUrl = apiUrl || API_URL;
  }

  /*****************************
   * Speech-To-Text POST
   * - file: Audio File
   *****************************/
  async stt_POST(file, quality) {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("quality", quality);
    const url = this.apiUrl + "/stt.php";
    const response = await fetch(url, { method: "POST", body: formData });
    const responseText = await response.text();
    return JSON.parse(responseText);
  }

  /*****************************
   * Language Model POST
   * - question: User question
   *****************************/
  async llm_POST(question) {
    const formData = new FormData();
    formData.append("message", question);

    // remember conversation
    if (this.conversation) {
      formData.append("conversation", this.conversation);
    }

    const url = this.apiUrl + "/llm.php";
    const response = await fetch(url, { method: "POST", body: formData });
    const responseText = await response.text();
    let json = JSON.parse(responseText);
    this.conversation = json.conversation;
    document.getElementById("conversation").textContent = " Received";
    return JSON.parse(responseText);
  }

  /*****************************
   * Text-To-Speech POST
   * - text: Text to be converted to speech
   *****************************/
  async tts_POST(text) {
    const formData = new FormData();

    // 4 = default = neutral
    let selectedEmotion = document.getElementById("thorsten-emotion").value;
    formData.append("emotion", selectedEmotion || "4");

    formData.append("text", text);
    const url = this.apiUrl + "/tts.php";
    const response = await fetch(url, { method: "POST", body: formData });
    const responseText = await response.text();
    return JSON.parse(responseText);
  }
}
const beezlebugApi = new BeezlebugApi(API_URL);


/*****************************
 *  Speech-To-Text Step
 * - Handles file input and sends to STT API
 *****************************/
async function startSTT() {
  // check empty file
  const file = document.getElementById("file").files?.[0];
  if (!file) return alert("Bitte eine Audiodatei wählen.");
  const quality = document.getElementById("whisper-model").value

  let clientStartTime = Date.now();
  clearSTT();
  document.getElementById("stt-text").textContent = "(wird transkribiert...)";
  document.getElementById("stt-success").classList.add("processing");
  try {
    const response = await beezlebugApi.stt_POST(file, quality);
    let responseTime = getResponseTime(clientStartTime, response.ms);
    // update html
    document.getElementById("stt-success").classList.remove("processing");
    document.getElementById("stt-success").classList.add("success");
    document.getElementById("stt-text").textContent = response.transcription;
    document.getElementById("stt-ms-server").textContent = "Bearbeitungsdauer: " + responseTime.server + " ms";
    document.getElementById("stt-ms-network").textContent = "Netzwerklatenz: " + responseTime.network + " ms";
    document.getElementById("stt-ms-total").textContent = "Gesamt: " + responseTime.total + " ms";
    document.getElementById("llm-question").value = response.transcription;
    return responseTime;
  } catch (e) {
    console.error(e);
  }
}

/*****************************
 *  Language Model Step
 * - Sends user question to LLM API
 *****************************/
async function startLLM() {
  // check empty input
  const question = document.getElementById("llm-question").value.trim();
  if (!question) return alert("Bitte eine Frage eingeben.");

  let clientStartTime = Date.now();
  clearLLM();
  document.getElementById("llm-text").textContent = "(Warte auf Antwort...)";
  document.getElementById("llm-success").classList.add("processing");
  try {
    const response = await beezlebugApi.llm_POST(question);
    let responseTime = getResponseTime(clientStartTime, response.ms);

    // update html
    document.getElementById("llm-processing").classList.remove("processing");
    document.getElementById("llm-success").classList.add("success");
    document.getElementById("llm-text").textContent = response.reply;
    document.getElementById("llm-ms-server").textContent = "Bearbeitungszeit: " + responseTime.server + " ms";
    document.getElementById("llm-ms-network").textContent = "Netzwerklatenz: " + responseTime.network + " ms";
    document.getElementById("llm-ms-total").textContent = "Gesamt: " + responseTime.total + " ms";
    document.getElementById("tts-text").value = response.reply;
    document.getElementById("llm-success").classList.add("success");
    document.getElementById("llm-success").classList.remove("processing");

    return responseTime;
  } catch (e) {
    console.error(e);
  }
}

/*****************************
 *  Text-To-Speech Step
 * - Sends text to TTS API and plays audio response
 *****************************/
async function startTTS() {
  // check empty
  const text = document.getElementById("tts-text").value.trim();
  if (!text) return alert("Bitte eine Antwort zum Vorlesen eingeben.");

  clearTTS();
  document.getElementById("tts-success").classList.add("processing");
  const clientStartTime = Date.now();
  try {
    const response = await beezlebugApi.tts_POST(text);
    let responseTime = getResponseTime(clientStartTime, response.ms);

    // Oops! No response
    if (!response.audio_data_url) {
      return alert("Keine Audiodaten erhalten.");
    }

    const player = document.getElementById("ttsPlayer");
    player.src = response.audio_data_url; // apply audio data
    // TODO toggle autoplay
    player.play().catch(() => { });

    // update html
    document.getElementById("tts-success").classList.remove("processing");
    document.getElementById("tts-success").classList.add("success");
    document.getElementById("tts-ms-server").textContent = "Bearbeitungszeit: " + responseTime.server + " ms";
    document.getElementById("tts-ms-network").textContent = "Netzwerklatenz: " + responseTime.network + " ms";
    document.getElementById("tts-ms-total").textContent = "Gesamt: " + responseTime.total + " ms";
    return responseTime;
  } catch (e) {
    console.error(e);
  }
}

/*****************************
 *  Full Pipeline
 * - STT -> LLM -> TTS
 *****************************/
async function startPipeline() {
  // Prepare run
  clearAll();
  document.getElementById("tts-text").value = "";
  document.getElementById("llm-question").value = "";
  document.getElementById("final-success").classList.add("processing");
  document.getElementById("loading").textContent = "(wird bearbeitet...)";
  let times = [];

  // STT Step
  let ms = await startSTT();
  times.push(ms)
  let transcription = document.getElementById("stt-text").textContent.trim();
  document.getElementById("llm-question").value = transcription;

  // LLM Step
  ms = await startLLM();
  times.push(ms);
  let answer = document.getElementById("llm-text").textContent.trim();
  document.getElementById("tts-text").value = answer;

  // TTS Step
  ms = await startTTS();
  times.push(ms);

  // Prepare Logs
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

  // Final UI Update
  document.getElementById("total-ms-server").textContent = "Bearbeitungszeit: " + finalMs.server + " ms";
  document.getElementById("total-ms-network").textContent = "Netzwerklatenz: " + finalMs.network + " ms";
  document.getElementById("total-ms-total").textContent = "Gesamt: " + finalMs.total + " ms";
  document.getElementById("final-success").classList.remove("processing");
  document.getElementById("final-success").classList.add("success");
  document.getElementById("loading").text = "Anfrage erfolgreich durchgeführt!";
}

/*****************************
 *  Button handlers
 *****************************/

// clear conversation button
function clearConversation() {
  beezlebugApi.conversation = "";
  document.getElementById("conversation").textContent = " none";
}

function clearSTT() {
  document.getElementById("stt-text").textContent = "(Sende eine Audio zum Transkribieren ein...)";
  document.getElementById("stt-text").value = "";
  document.getElementById("stt-ms-server").textContent = "";
  document.getElementById("stt-ms-network").textContent = "";
  document.getElementById("stt-ms-total").textContent = "";
  document.getElementById("stt-success").classList.remove("success");
  document.getElementById("stt-success").classList.remove("processing");
}

function clearLLM() {
  document.getElementById("llm-text").textContent = "(Frage den Chatbot für eine Antwort!)";
  document.getElementById("llm-ms-server").textContent = "";
  document.getElementById("llm-ms-network").textContent = "";
  document.getElementById("llm-ms-total").textContent = "";
  document.getElementById("llm-success").classList.remove("success");
  document.getElementById("llm-success").classList.remove("processing");
}

function clearTTS() {
  document.getElementById("tts-text").textContent = "";
  document.getElementById("tts-ms-server").textContent = "";
  document.getElementById("tts-ms-network").textContent = "";
  document.getElementById("tts-ms-total").textContent = "";
  document.getElementById("tts-success").classList.remove("processing");
  document.getElementById("tts-success").classList.remove("success");
}

// clear all button
function clearAll() {
  clearSTT();
  clearLLM();
  clearTTS();
  document.getElementById("total-ms-server").textContent = "";
  document.getElementById("total-ms-network").textContent = "";
  document.getElementById("total-ms-total").textContent = "";
  document.getElementById("final-success").classList.remove("processing");
  document.getElementById("final-success").classList.remove("success");
  document.getElementById("loading").textContent = "";
}

// Push-to-Talk Button
document.getElementById("push-to-talk-begin").addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Spacebar") { // " " für moderne Browser, "Spacebar" für ältere
    event.preventDefault();
    recordAudio()
  }
});

/*************************************************************
 *  Utility Functions
 *************************************************************/

/*****************************
 *  Get Response Times
 * - (server, network, total)
 *****************************/
function getResponseTime(start, response) {
  const msServer = response;
  const msNetwork = Date.now() - start - msServer;
  const msTotal = msServer + msNetwork;
  const times = {
    server: Math.round(msServer),
    network: Math.round(msNetwork),
    total: Math.round(msTotal)
  };
  return times;
}

/*****************************
 *  FileInput Listener
 * - Preview audio file in player
 *****************************/
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  fileInputPlayer.src = url;
  fileInputPlayer.load();
});

/*****************************
 *  Start ms-timer when activating Push-to-Talk
 *****************************/
async function startTimer() {
  pttStartTime = performance.now();
  function timeStep() {
    const elapsed = performance.now() - pttStartTime;
    if (micIsRecording) {
      pttButton.textContent = elapsed / 1000.0 + " s";
      animationFrameId = requestAnimationFrame(timeStep);
    }

  }
  timeStep();
}
/*****************************
 *  Reset Timer and animationFrameId
 *****************************/
async function stopTimer() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

// Audi wird akzeptiert mit audio/webm & audio/webm;codecs=opus
async function recordAudio() {
  pttButton.classList.add('push-to-talk-active');
  try {

    // stop recording
    if (micIsRecording) {
      recorder.stop();
      pttButton.classList.remove('push-to-talk-active');
      return;
    }

    // Start recording
    clearAll();

    // audiostream settings
    // with browser asking for microphone-permission
    recorderStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false }, video: false
    });

    // mediarecorder init
    let supportedMime = findSupportedMime();
    recorder = new MediaRecorder(recorderStream, { mimeType: supportedMime });
    recorderChunks = [];

    // push recording chunks
    recorder.ondataavailable = function (e) {
      if (e.data && e.data.size) {
        recorderChunks.push(e.data);
      }
    }

    // recorder stop listener
    recorder.onstop = function () {
      stopTimer()

      // generate blob/url
      const audioBlob = new Blob(recorderChunks, { type: recorder.mimeType || 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // create audio fille and put as input
      const audioFile = new File([audioBlob], "recording.webm", { type: recorder.mimeType });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(audioFile);
      fileInput.files = null;
      fileInput.files = dataTransfer.files;

      fileInputPlayer.src = audioUrl;
      //fileInputPlayer.load();

      // when file ready => start pipeline
      window.onAudioReady?.(audioBlob, audioUrl);
      startPipeline();

      clearStreamTracks();
      recorderStream = null;
      pttButton.textContent = 'Push-to-talk';
      micIsRecording = false;
    };

    // Start Recording
    recorder.start();
    pttButton.textContent = '00:00:00';
    micIsRecording = true;
    startTimer();
  } catch (err) {
    clearStreamTracks();
    recorderStream = null;
    micIsRecording = false;
     pttButton.textContent = "Push-to-Talk";
  }
}

// stop streams
function clearStreamTracks() {
  recorderStream.getTracks().forEach(t => {
    t.stop();
  })
}

function findSupportedMime() {
  const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  const hit = mimes.find(t => MediaRecorder.isTypeSupported?.(t) || "");
  return hit;
}
