from flask import Flask, request, jsonify

app = Flask(__name__)

diagnosis_guideline = """
You are a medical assistant helping diagnose patients during a measles outbreak.

You will receive a series of inputs describing different parts of a patient's body.
Each input may contain text information, images, or both. The input will be provided
in the following JSON-like format:

{
    "body-part": "name of the body part",
    "symptom": "name of the symptom",
    "symptom-description": "text description of the symptom",
    "symptom-image": "base64-encoded image data"
}

- If any fields are missing or null, simply ignore them.
- When a symptom image is provided, analyze it for visible signs of measles (such as rash, spots, discoloration).

Continue collecting symptom information as it is provided.
When the user indicates they are done adding symptoms, use all the gathered information to:
1. Generate a final diagnosis report.
2. Estimate and report a numerical probability (0-100%) that the patient is infected with measles.

Make sure your diagnosis is careful, considers all symptoms provided, and clearly communicates your conclusion. 
This will be one part of your output which will be a JSON object with the following structure:

{
    "diagnosis_report": "Your diagnosis report here",
    "follow-ups": [ a list of follow-up questions or actions ]
}

For the follow-ups, if you feel there is information necessary from the patient that can better help you
in diagnosing, ask for it. For example, you can ask about:
- Other symptoms not mentioned
- Duration of symptoms
- Any recent travel history
- Contact with infected individuals
- Vaccination history
- Any other relevant medical history

These could be yes and no questions too and have to be saved as a list of strings. 
"""

messages = [
            {
                "role": "system",
                "content": diagnosis_guideline
            }
        ]

@app.route('/image-capture', methods=['POST'])
def image_capture():
    import cv2
    import base64

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            raise RuntimeError("Failed to read frame from camera")

        cv2.imshow('Capture Image (Press SPACE)', frame)

        key = cv2.waitKey(1)
        if key == 32:  # SPACE key
            break

    cap.release()
    cv2.destroyAllWindows()

    success, encoded_image = cv2.imencode('.jpg', frame)
    if not success:
        raise ValueError("Failed to encode captured frame")
    base64_image = base64.b64encode(encoded_image.tobytes()).decode('utf-8')
    return base64_image

@app.route('/audio-capture-transcribe', methods=['POST'])
def audio_capture_and_transcribe(
    seconds: int = 5,
    samplerate: int = 48_000,
    channels: int = 1) -> str:

    import os
    import io
    import sounddevice as sd
    import soundfile as sf
    import requests
    import dotenv
    dotenv.load_dotenv(".env")

    recording = sd.rec(
        int(seconds * samplerate),
        samplerate=samplerate,
        channels=channels,
        dtype="int16",
    )
    sd.wait() 

    wav_buffer = io.BytesIO()
    sf.write(wav_buffer, recording, samplerate, format="WAV", subtype="PCM_16")
    wav_buffer.seek(0)  

    headers = {"Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}"}
    files = {
        "file": ("recording.wav", wav_buffer, "audio/wav"),
        "model": (None, "whisper-large-v3"),
    }

    resp = requests.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers=headers,
        files=files,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"Groq error {resp.status_code}: {resp.text}")

    return resp.json()["text"]

@app.route('/add-sympton', methods=['POST'])
def add_sympton():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    body_part = data.get("body-part")
    symptom = data.get("symptom")
    symptom_description = data.get("symptom-description")
    symptom_image = data.get("symptom-image")

    if not body_part or not symptom:
        return jsonify({"error": "Missing required fields"}), 400

    messages.append(
        {
            "role": "user",
            "content": """
                Raw input:
                {data},
                Body part: {body_part}
                Symptom: {symptom}
                Description: {symptom_description} 
                Encoded Image: {symptom_image}
                """.format(
                    data=data,
                    body_part=body_part,
                    symptom=symptom,
                    symptom_description=symptom_description if symptom_description else "",
                    symptom_image=symptom_image if symptom_image else ""
                )
        }
    )
    return jsonify({"message": "Symptom added successfully"}), 200

@app.route('/diagnose', methods=['POST'])
def diagnose():
    from groq import Groq
    import os, dotenv
    dotenv.load_dotenv(".env")
    print("GROK KEY:", os.getenv("GROQ_API_KEY"))

    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=messages,
            temperature=1,
            max_completion_tokens=1024,
            top_p=1,
            stream=False,
            stop=None,
        )
        diagnosis_report = completion.choices[0].message.content
        return jsonify({"diagnosis_report": diagnosis_report}), 200
    except Exception as e:
        return jsonify({"error": f"Failed in generating diagnosis report: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=200, debug=True)