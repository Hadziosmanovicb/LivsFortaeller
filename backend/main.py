from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "LivsFortæller API virker!"
    }

from fastapi import UploadFile, File

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    return {
        "message": "Lydfil modtaget!",
        "filename": file.filename
    }
