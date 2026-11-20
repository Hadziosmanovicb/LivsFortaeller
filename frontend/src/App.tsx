
import { useRef, useState } from "react";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
const [transcription, setTranscription] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
const [biography, setBiography] = useState("");
const [isGenerating, setIsGenerating] = useState(false);
const [question, setQuestion] = useState("");
const [isAsking, setIsAsking] = useState(false);
const [interviewAnswer, setInterviewAnswer] = useState("");
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
    setTranscription("AI behandler din optagelse...");

    const response = await fetch(audioUrl);
    const audioBlob = await response.blob();

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    const result = await fetch("http://127.0.0.1:8000/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!result.ok) {
      throw new Error("Transskription mislykkedes");
    }

    const data = await result.json();
    if (question) {
  // Et interviewspørgsmål er aktivt
  setInterviewAnswer(data.text);
} else {
  // Den første fortælling
  setTranscription(data.text);
}
  } catch (error) {
    console.error(error);
    setTranscription("Der opstod en fejl.");
  }
}

async function generateBiography() {
  if (!transcription.trim() || isGenerating) return;

  try {
    setIsGenerating(true);
    setBiography("");

    const response = await fetch("http://127.0.0.1:8000/biography", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: transcription,
      }),
    });

    if (!response.ok) {
      throw new Error("Kunne ikke generere biografi");
    }

    const data = await response.json();
    setBiography(data.biography);
  } catch (error) {
    console.error(error);
    alert("Der opstod en fejl ved generering af biografien.");
  } finally {
    setIsGenerating(false);
  }
}


async function askQuestion() {
  if (!biography.trim() || isAsking) return;

  try {
    setIsAsking(true);
    setQuestion("");

    const response = await fetch("http://127.0.0.1:8000/interview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        biography: biography,
      }),
    });

    if (!response.ok) {
      throw new Error("Kunne ikke hente spørgsmål");
    }

    const data = await response.json();
    setQuestion(data.question);

  } catch (error) {
    console.error(error);
    alert("Der opstod en fejl med AI-intervieweren.");
  } finally {
    setIsAsking(false);
  }
}

async function updateBiography() {
  if (!biography || !question || !interviewAnswer || isGenerating) {
    return;
  }

  try {
    setIsGenerating(true);

    const response = await fetch(
      "http://127.0.0.1:8000/biography/update",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          biography: biography,
          question: question,
          answer: interviewAnswer,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Kunne ikke opdatere biografien");
    }

    const data = await response.json();

    // Vis den opdaterede biografi
    setBiography(data.biography);

    // Nulstil interviewet til næste spørgsmål
    setQuestion("");
    setInterviewAnswer("");

  } catch (error) {
    console.error(error);
    alert("Der opstod en fejl ved opdatering.");
  } finally {
    setIsGenerating(false);
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

{transcription && (
  <div>
    <h2>Din fortælling</h2>
    <p>{transcription}</p>

    <button
      onClick={generateBiography}
      disabled={isGenerating}
    >
      {isGenerating ? "AI skriver..." : "Generér biografi"}
    </button>
  </div>
)}


{biography && (
  <div>
    <h2>Din biografi</h2>
    <p>{biography}</p>

    <button
      onClick={askQuestion}
      disabled={isAsking}
    >
      {isAsking ? "AI tænker..." : "Stil et opfølgende spørgsmål"}
    </button>
  </div>
)}


{question && (
  <div>
    <h2>AI-interviewer</h2>
    <p>{question}</p>

    <p>🎤 Brug mikrofonen ovenfor til at svare.</p>

 
{interviewAnswer && (
  <div>
    <h3>Dit svar</h3>
    <p>{interviewAnswer}</p>

    <button
      onClick={updateBiography}
      disabled={isGenerating}
    >
      {isGenerating ? "Opdaterer..." : "Opdater biografi med mit svar"}
    </button>
  </div>
)}

  </div>
)}



        </div>
      )}
    </main>
  );
}

export default App;
