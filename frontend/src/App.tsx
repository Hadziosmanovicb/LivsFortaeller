
import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [timeline, setTimeline] = useState<
  { date: string; event: string }[]
>([]);
  const [biography, setBiography] = useState("");
  const [liveText, setLiveText] = useState("");
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [storyFacts, setStoryFacts] = useState<string[]>([]);
  const [question, setQuestion] = useState(
    "Hvem vil du gerne fortælle om?"
  );
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
const liveRecognitionRef = useRef<{
  stop: () => void;
} | null>(null);
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );
    };
  }, []);

  async function apiPost(
    endpoint: string,
    body: object
  ) {
    const response = await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API-fejl: ${response.status}`);
    }

    return response.json();
  }

function startLiveTranscription() {
  type SpeechResult = {
    isFinal: boolean;
    0: { transcript: string };
  };

  type SpeechRecognizer = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: {
      results: ArrayLike<SpeechResult>;
    }) => void) | null;
    start: () => void;
    stop: () => void;
  };

  type SpeechRecognizerConstructor = new () => SpeechRecognizer;

  const browser = window as typeof window & {
    SpeechRecognition?: SpeechRecognizerConstructor;
    webkitSpeechRecognition?: SpeechRecognizerConstructor;
  };

  const Recognition =
    browser.SpeechRecognition ||
    browser.webkitSpeechRecognition;

  if (!Recognition) {
    return null;
  }

  const recognition = new Recognition();

  recognition.lang = "da-DK";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let text = "";

    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript + " ";
    }

    setLiveText(text.trim());
  };

  recognition.start();

  return recognition;
}

  async function startRecording() {
    try {
      setError("");
      setDraft("");

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        stream.getTracks().forEach(
          (track) => track.stop()
        );
        streamRef.current = null;

        await transcribeAudio(audio);
      };

     setLiveText("");
recorder.start();
setRecording(true);

try {
  liveRecognitionRef.current = startLiveTranscription();
} catch {
  // Den eksisterende OpenAI-optagelse virker stadig
}
    } catch {
      setError("Kunne ikke få adgang til mikrofonen.");
    }
  }

  function stopRecording() {
    liveRecognitionRef.current?.stop();
liveRecognitionRef.current = null;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }

    setRecording(false);
  }

  async function transcribeAudio(audio: Blob) {
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append(
        "file",
        audio,
        audio.type.includes("mp4")
          ? "recording.mp4"
          : "recording.webm"
      );

      const response = await fetch(`${API}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Transskription mislykkedes");
      }

      const data = await response.json();
      setDraft(data.text || "");
    } catch {
      setError("Kunne ikke omdanne tale til tekst.");
    } finally {
      setLoading(false);
    }
  }

  async function approveAnswer() {
    if (!draft.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      let newBiography: string;

      if (!biography) {
        const data = await apiPost("/biography", {
          text: draft,
        });

        newBiography = data.biography;
      } else {
        const data = await apiPost(
          "/biography/update",
          {
  biography,
  question,
  answer: draft,
  story_facts: storyFacts,
}
        );

        newBiography = data.biography;
      }

      // Gem brugerens oprindelige, godkendte svar


setStoryFacts((previous) => [...previous, draft]);
setBiography(newBiography);
setDraft("");
     
const next = await apiPost("/interview", {
  biography: newBiography,
  previous_questions: previousQuestions,
});

// Gem spørgsmålet, så AI ikke gentager det
setPreviousQuestions((previous) => [
  ...previous,
  next.question,
]);

setQuestion(next.question);

    } catch {
      setError(
        "Noget gik galt. Kontrollér resultatet, før du prøver igen."
      );
    } finally {
      setLoading(false);
    }
  }

async function finishStory() {
  if (!biography.trim() || loading) return;

  setLoading(true);
  setError("");

  try {
    const data = await apiPost("/timeline", {
      biography: biography,
    });

    setTimeline(data.events);
    setFinished(true);

  } catch (error) {
    console.error(error);
    setError("Kunne ikke generere tidslinjen.");
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">✦</span>
          LivsFortæller
        </div>
        <span className="header-subtitle">
          Din historie, dine ord
        </span>
      </header>

      <main className="main">
        <section className="intro">
          <span className="eyebrow">
            BEVAR DET, DER BETYDER NOGET
          </span>
          <h1>Ethvert liv har en historie.</h1>
          <p>
            Fortæl med din stemme. Vi hjælper dig
            med at samle minderne til en livsfortælling.
          </p>
        </section>

        {biography && !finished && (
          <section className="biography-card">
            <div className="card-heading">
              <span>✦</span> Din biografi
            </div>

            <textarea
              className="biography-text"
              value={biography}
              onChange={(event) =>
                setBiography(event.target.value)
              }
              aria-label="Redigér din biografi"
              rows={6}
            />

            <p className="hint">
              Du kan selv rette teksten.
            </p>
          </section>
        )}

        {!finished ? (
          <section className="conversation">
            <span className="eyebrow">
              DIN AI-INTERVIEWER
            </span>

            <h2>{question}</h2>

            <button
              className={`mic-button ${
                recording ? "active" : ""
              }`}
              onClick={
                recording ? stopRecording : startRecording
              }
              disabled={loading || !!draft}
              aria-label={
                recording
                  ? "Stop optagelse"
                  : "Start optagelse"
              }
            >
              {recording ? "■" : "🎙"}
            </button>

            <p className="recording-status">
              {recording
                ? "Optager... Tryk for at stoppe"
                : loading
                  ? "AI arbejder..."
                  : draft
                    ? "Gennemgå din tekst nedenfor"
                    : "Tryk på mikrofonen for at tale"}
            </p>
{recording && liveText && (
  <div className="draft-box">
    <p>🎙️ {liveText}</p>
  </div>
)}
            {draft && (
              <div className="draft-box">
                <label htmlFor="draft">
                  Det hørte vi:
                </label>

                <textarea
                  id="draft"
                  value={draft}
                  rows={4}
                  onChange={(event) =>
                    setDraft(event.target.value)
                  }
                />

                <div className="draft-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setDraft("")}
                    disabled={loading}
                  >
                    Prøv igen
                  </button>

                  <button
                    className="primary-button"
                    onClick={approveAnswer}
                    disabled={loading || !draft.trim()}
                  >
                    Godkend og fortsæt
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            {biography && (
              <button
                className="finish-button"
                disabled={recording || loading}
                onClick={finishStory}
              >
                Jeg er tilfreds med min biografi ✓
              </button>
            )}
          </section>
        ) : (
          <section className="conversation">
            <div className="finish-icon">✓</div>
            
<div className="biography-card" style={{ textAlign: "left" }}>
  <div className="card-heading">
    ✦ Din livshistorie
  </div>

  <textarea
    className="biography-text"
    value={biography}
    onChange={(event) => setBiography(event.target.value)}
    aria-label="Redigér din livshistorie"
    rows={6}
  />
</div>

<h3>Livets tidslinje</h3>

<ol style={{ textAlign: "left", lineHeight: 1.8 }}>
  {timeline.map((item, index) => (
    <li key={index}>
      
<input
  type="text"
  value={item.date}
  aria-label={`Dato for begivenhed ${index + 1}`}
  onChange={(event) => {
    setTimeline((previous) =>
      previous.map((entry, i) =>
        i === index
          ? { ...entry, date: event.target.value }
          : entry
      )
    );
  }}
  style={{
    width: "120px",
    padding: "8px",
    marginBottom: "8px",
    fontWeight: 600,
  }}
/>

      
<textarea
  value={item.event}
  aria-label={`Redigér begivenhed ${index + 1}`}
  rows={2}
  onChange={(e) => {
    setTimeline((previous) =>
      previous.map((entry, i) =>
        i === index
          ? { ...entry, event: e.target.value }
          : entry
      )
    );
  }}
/>

    </li>
  ))}
</ol>

            <p>
              Du kan stadig redigere din biografi ovenfor.
            </p>
            <button
              className="secondary-button"
              onClick={() => setFinished(false)}
            >
              Fortsæt interviewet
            </button>
          </section>
        )}

        <footer className="footer">
          Din fortælling forbliver i denne session.
          Intet offentliggøres automatisk.
        </footer>
      </main>
    </div>
  );
}

export default App;
