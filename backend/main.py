
import os
import logging
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI

load_dotenv()

app = FastAPI()
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "LivsFortæller API virker!"}

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    try:
        audio = await file.read()

        result = await client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",
            file=(file.filename or "recording.webm", audio,
                  file.content_type or "audio/webm"),
            language="da",
        )

        logger.info("Transskription gennemført")
        return {"text": result.text}

    except Exception:
        logger.exception("Transskription mislykkedes")
        raise HTTPException(
            status_code=500,
            detail="Kunne ikke transskribere optagelsen."
        )

class BiographyRequest(BaseModel):
    text: str


@app.post("/biography")
async def generate_biography(request: BiographyRequest):
    response = await client.responses.create(
        model="gpt-6-luna",
        instructions=(
            "Du er en dansk biografiforfatter. "
            "Omskriv brugerens tekst til en kort, "
            "naturlig og velskrevet biografi i tredje person. "
            "Brug kun oplysninger fra brugerens tekst. "
            "Du må aldrig opfinde navne, datoer, steder "
            "eller andre personlige fakta. "
            "Hvis noget er uklart, skal du udelade det. "
            "Svar kun med biografien."
        ),
        input=request.text,
        max_output_tokens=250,
    )

    return {"biography": response.output_text}
