<?php
/* HTTP-Endpunkt
*   Params:
*     - "file" : .mp3 File
*/
declare(strict_types=1);
header("Content-Type: application/json; charset=utf-8");
$startTime = microtime(true);

// ===== CORS =====
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");
if (($_SERVER["REQUEST_METHOD"] ?? "GET") === "OPTIONS") { http_response_code(204); exit; }

// ===== Err Log =====
$fail = function (int $code, string $msg, array $extra = []) {
    http_response_code($code);
    echo json_encode(["ok" => false, "error" => $msg] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
};

// ===== Config =====
$AUDIO_FILE  = __DIR__ . "/hallo3.mp3"; // Default fallback
$WHISPER_BIN = "/Users/customer/Sprachbot/STT/whisper.cpp/build/bin/whisper-cli"; // absolute path
$MODEL_BIN   = "/Users/customer/Sprachbot/STT/whisper.cpp/models/ggml-small.bin"; // absolute path
$LANG        = "de";

// ===== Check binaries =====
$defaultPath = getenv("PATH") ?: "/usr/bin:/bin";
putenv("PATH=/opt/homebrew/bin:/usr/local/bin:" . $defaultPath);

// FFMPEG check
$FFMPEG = trim(shell_exec("command -v ffmpeg") ?? ""); // get location
if ($FFMPEG === "" || !is_executable($FFMPEG)) {
    $fail(500, "ffmpeg not found");
}

// Whisper Model Check
if (!is_file($MODEL_BIN)) {
  $fail(500, "model missing");
}

// Whisper bin Check
if (!is_file($WHISPER_BIN) || !is_executable($WHISPER_BIN)) {
    $fail(500, "whisper missing/not exec");
}

// ===== Check for uploaded file =====
$uploadedTmp = null;

// check for missing file
if (empty($_FILES["file"])) {
  $fail(400, "no audio uploaded");
}
$inputFile = $_FILES["file"]["tmp_name"];

// ===== TMP Dir =====
$base      = sys_get_temp_dir() . "/stt_" . bin2hex(random_bytes(6));
$tmpWav    = $base . ".wav";
$outPrefix = $base . "_out";
$jsonOut   = $outPrefix . ".json";

// ===== MP3 -> WAV (16k, mono) =====
// TODO Check if not already .wav
$cmdFfmpeg = $FFMPEG
   . " -y -loglevel error" // -y = overwrite without asking
   . " -i " . escapeshellarg($inputFile) // -i = from input
   . " -ac 1 -ar 16000 " // -ac = audio chanel 1 (mono), 16k
   . escapeshellarg($tmpWav) // tmp location
   . " 2>&1"; // redirect standard error to standard output

$ffmpegOut = shell_exec($cmdFfmpeg);

// file not generated oopsie
if (!is_file($tmpWav)) {
    $fail(500, "ffmpeg failed", ["detail" => $ffmpegOut]);
}

// ===== Whisper processing =====
$cmdWhisper =
  escapeshellarg($WHISPER_BIN) .
  " -m " . escapeshellarg($MODEL_BIN) . // -m = model file name
  " -f " . escapeshellarg($tmpWav) . // -f = input file name
  " -l " . escapeshellarg($LANG) . // -l = LANG
  " -t 12 -oj -of " . escapeshellarg($outPrefix) . // -t = threads, oj = output json
  " 2>&1"; // redirect standard error to standard output
$whisperOut = shell_exec($cmdWhisper);

// check for whisper output
if (!is_file($jsonOut)) {
  // cleanup
    @unlink($tmpWav);
    $fail(500, "no whisper json", ["detail" => $whisperOut]);
}
$data = json_decode(file_get_contents($jsonOut), true) ?: [];

$segments = $data['data']['transcription'] ?? $data['transcription'] ?? null;
$transcription = '';
if (is_array($segments)) {
    foreach ($segments as $seg) {
        $transcription .= (string)($seg['text'] ?? '');
    }
    $transcription = trim($transcription);
} elseif (is_string($segments)) {
    $transcription = trim($segments);
}

// ===== Cleanup =====
@unlink($tmpWav);
@unlink($jsonOut);
if ($uploadedTmp) { @unlink($uploadedTmp); }

// ===== Response =====
if ($raw === "") {
    http_response_code(200);
    echo json_encode(["ok" => false, "warning" => "no transcript text"], JSON_UNESCAPED_UNICODE);
    exit;
}

$ms = round((microtime(true) - $startTime) * 1000, 2);
http_response_code(200);

echo json_encode([
    "transcription" => $transcription,
    "ms"            => $ms
], JSON_UNESCAPED_UNICODE);
