
import { useRef, useState } from "react";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    try {
      setError("");

      // Spørg brugeren om adgang til mikrofonen
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      // Opret en lydoptager
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Saml lydoptagelsen
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType,
        });

        setAudioUrl((previousUrl) => {
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          return URL.createObjectURL(audioBlob);
        });

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Kunne ikke få adgang til mikrofonen.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setIsRecording(false);
  }

async function sendAudio() {
  if (!audioUrl) return;

  try {
    // Hent lydoptagelsen fra browseren
    const response = await fetch(audioUrl);
    const audioBlob = await response.blob();

    // Pak lydfilen, så FastAPI kan modtage den
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    // Send lydfilen til vores Python-backend
    const result = await fetch("http://127.0.0.1:8000/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!result.ok) {
      throw new Error("Serveren kunne ikke modtage lydfilen.");
    }

    const data = await result.json();
    alert(data.message);
  } catch (error) {
    console.error(error);
    alert("Kunne ikke sende lydfilen.");
  }
}

  return (
    <main style={{ textAlign: "center", padding: "60px 20px" }}>
      <h1>LivsFortæller</h1>
      <p>Fortæl din historie med din egen stemme.</p>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        style={{ padding: "15px 25px", cursor: "pointer" }}
      >
        {isRecording ? "⏹ Stop optagelse" : "🎤 Start optagelse"}
      </button>

      {isRecording && <p>🔴 Optager...</p>}
      {error && <p role="alert">{error}</p>}

      {audioUrl && (
        <div style={{ marginTop: "30px" }}>
          <h3>Din optagelse</h3>
          <audio controls src={audioUrl} />
          <button onClick={sendAudio}>
  Send lyd til Python
</button>
        </div>
      )}
    </main>
  );
}

export default App;
