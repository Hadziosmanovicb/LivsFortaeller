
import os
import logging

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
