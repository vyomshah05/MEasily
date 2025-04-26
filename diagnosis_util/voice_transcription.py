from openai import OpenAI

def audio_transcription(audio_file_path: str) -> str:
    import os, requests
    import dotenv
    dotenv.load_dotenv(".env.local")
    
    headers = {"Authorization": f"Bearer {os.getenv("GROQ_API_KEY")}"}
    files   = {
        "file": open(f"{audio_file_path}", "rb"),
        "model": (None, "whisper-large-v3")
    }

    resp = requests.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers=headers,
        files=files
    )
    
    if resp.status_code != 200:
        raise Exception(f"Error {resp.status_code}: {resp.text}")
    return resp.json()["text"]   

if __name__ == "__main__":
    audio_transcription("audio/test_audio.m4a")