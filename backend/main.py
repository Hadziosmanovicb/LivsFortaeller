
import os
import logging
from pydantic import BaseModel, Field
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

from pydantic import BaseModel, Field
class BiographyRequest(BaseModel):
    text: str
    story_facts: list[str] = Field(default_factory=list)


@app.post("/biography")
async def generate_biography(request: BiographyRequest):

    # Saml tidligere fortællinger og det nye svar
    all_stories = request.story_facts + [request.text]

    # Lav én samlet tekst til AI'en
    combined_text = "\n".join(all_stories)

    response = await client.responses.create(
        model="gpt-6-luna",
        instructions=(
            "Du er en dansk biografiforfatter. "
            "Du modtager flere fortællinger om samme person. "
            "Saml dem til én naturlig og sammenhængende biografi. "
            "Skriv i tredje person på dansk. "
            "Bevar relevante oplysninger fra fortællingerne. "
            "Undgå gentagelser. "
            "Opfind aldrig personlige fakta, datoer eller steder. "
            "Hvis oplysninger modsiger hinanden, må du ikke gætte. "
            "Svar kun med biografien."
        ),
        input=combined_text,
        max_output_tokens=350,
    )

    return {"biography": response.output_text}



class InterviewRequest(BaseModel):
    biography: str
    previous_questions: list[str] = Field(default_factory=list)

@app.post("/interview")
async def generate_interview_question(request: InterviewRequest):
    response = await client.responses.create(
        model="gpt-6-luna",
        instructions=(
            "Du er LivsFortæller, en venlig dansk AI-interviewer. "
            "Du hjælper brugeren med at indsamle oplysninger "
            "til en personlig biografi. "
            "Læs den nuværende biografi og stil præcis ét "
            "relevant opfølgende spørgsmål på dansk. "
            "Spørg om noget vigtigt, som biografien mangler. "
            "Du må ikke antage eller opfinde personlige fakta. "
            "Spørgsmålet skal være kort, naturligt og venligt. "
            "Svar kun med selve spørgsmålet."
        ),
        input=(
    f"Nuværende biografi:\n{request.biography}\n\n"
    "Tidligere stillede spørgsmål:\n"
    + "\n".join(request.previous_questions)
    + "\n\nStil ét nyt relevant spørgsmål, "
      "som ikke gentager de tidligere spørgsmål."
),
        max_output_tokens=120,
    )

    return {"question": response.output_text}



class UpdateBiographyRequest(BaseModel):
    biography: str
    question: str
    answer: str
    
@app.post("/biography/update")
async def update_biography(request: UpdateBiographyRequest):
    response = await client.responses.create(
        model="gpt-6-luna",
        instructions=(
            "Du er en dansk biografiforfatter. "
            "Du får en eksisterende biografi, et interviewspørgsmål "
            "og brugerens svar. "
            "Opdater biografien med de nye oplysninger. "
            "Bevar alle korrekte oplysninger fra den eksisterende biografi. "
            "Brug kun oplysninger, som brugeren har givet. "
            "Opfind aldrig fakta, datoer, navne eller begivenheder. "
            "Hvis svaret er uklart eller ikke giver mening, "
            "skal du bevare biografien uændret. "
            "Skriv naturligt på dansk i tredje person. "
            "Returner kun den opdaterede biografi."
            "Brugerens svar kan også være feedback til biografien. "
"Hvis brugeren beder om en anden skrivestil, skal du "
"omskrive biografien uden at ændre dens fakta. "
"Hvis brugeren retter en konkret oplysning, skal du "
"bruge rettelsen frem for den gamle oplysning. "
"Du må ikke opfinde nye personlige oplysninger. "
        ),
        input=(
            f"Biografi:\n{request.biography}\n\n"
            f"Spørgsmål:\n{request.question}\n\n"
            f"Svar:\n{request.answer}"
        ),
        max_output_tokens=350,
    )

    return {"biography": response.output_text}
