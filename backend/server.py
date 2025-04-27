from flask import Flask, request, jsonify
from flask_cors import CORS
from uagents import Agent, Context, Model

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:8000"}})

diagnosis_guideline = """
You are a medical assistant helping analyze the risk of patients being infected during a measles outbreak.

You will receive a series of inputs describing different parts of a patient's body.
Each input may contain text information, images, or both. The input will be provided
in the following JSON-like format:

{
    "body-part": "name of the body part",
    "symptom-description": "text description of the symptom",
    "symptom-image": "base64-encoded image data"
}

- If any fields are missing or null, simply ignore them.
- When a symptom image is provided, analyze it for visible signs of measles (such as rash, spots, discoloration).

Continue collecting symptom information as it is provided.
When the user indicates they are done adding symptoms, use all the gathered information to perform 2 steps:
1. Generate a sequence of relevant follow up questions.
2. FINAL OUTPUT: Once the user answers these questions, use the answers and all the symptons recorded previously to getting the follow-up responses to generate a risk analysis report.
"""

messages = [
            {
                "role": "system",
                "content": diagnosis_guideline
            }
        ]

@app.route('/audio-capture-transcribe', methods=['POST'])
def transcribe_audio():
    import os, requests, dotenv
    from flask import request, jsonify
    dotenv.load_dotenv(".env")

    if 'file' not in request.files:
        return jsonify(error="No file part"), 400
    audio = request.files['file']
    if audio.filename == '':
        return jsonify(error="Empty filename"), 400

    headers = {"Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}"}
    files = {
        "file": (audio.filename, audio.stream, audio.mimetype),
        "model": (None, "whisper-large-v3"),
    }

    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers=headers,
            files=files,
            timeout=(10, 120)          
        )
        resp.raise_for_status()
    except requests.exceptions.ReadTimeout:
        return jsonify(error="Groq timed out, please retry"), 504
    except requests.exceptions.RequestException as e:
        return jsonify(error=str(e)), 502

    return jsonify(text=resp.json()["text"]), 200


def send_to_fetch_agent(diagnosis: dict):
    
    class Message(Model):
        report : str
        conclusion : str

    send_diagnosis_agent = Agent(
        name = 'Analysis Sender',
        port = 5050,
        endpoint = ['http://localhost:5051/submit']
    )
    
    reciever_agent = "second-agent-addr"

    @send_diagnosis_agent.on_event('startup')
    async def startup_handler(ctx : Context):
        ctx.logger.info(f'I have recieved diagnosis and will send you report: {ctx.agent.address}')
        await ctx.send(reciever_agent, Message(diagnosis["risk"], diagnosis["conclusion"]))
    
    send_diagnosis_agent.run()


@app.route('/follow-up', methods=['POST'])
def follow_up():
    from groq import Groq
    import os, dotenv
    dotenv.load_dotenv(".env")

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400

    messages.append({
        "role": "system",
        "content": """
           You are in step 1 of the risk analysis process.
            The patient (user) will give you a list of json objects describing the symptoms of the patient.
            Each object contains the following fields and is as described earlier:
            - body-part: name of the body part
            - symptom-description: text description of the symptom
            - symptom-image: base64-encoded image data

            Now you have to ask some follow-up questions. If you feel there is information necessary from the patient that can better help you
            in analyzing, ask for it. For example, you can ask about:

            - Other symptoms not mentioned
            - Duration of symptoms
            - Any recent travel history
            - Contact with infected individuals
            - Measles Vaccination history
            - Any other relevant medical history

            These could be yes and no questions too and have to be saved as a list of strings. Do not ask for images.
            You can have a maximum of 5 follow-up questions. Make sure not to ask repetitive questions if it has already been answered.

            Remember the guidelines you are given about how to come up with the follow-up questions.
            Your output for right now should only be a python JSON object with the structure as given below, no other
            words or explanations should be included in your output.

            {{
                "follow-ups": [
                    "question 1",
                    "question 2",
                    "question 3",
                    "question 4",
                    "question 5"
                ]
            }}

            The questions should be in a list of strings. 
            """
    })

    messages.append({
        "role": "user",
        "content": """
            Here is the symptom data:
            -----------
            {data}
            """.format(data=data)
    })

    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=messages,
            temperature=1,
            max_completion_tokens=4000,
            top_p=1,
            stream=False,
            stop=None,
        )
        follow_up_questions = completion.choices[0].message.content
        sympt_msg = messages.pop()
        messages.pop(); messages.append(sympt_msg) # remove follow-up instruction to avoid instruction-conflicts
        return jsonify({"follow-ups": follow_up_questions}), 200
    except Exception as e:
        return jsonify({"error": f"Failed in generating diagnosis report: {str(e)}"}), 500

@app.route('/diagnose', methods=['POST'])
def diagnose():
    from groq import Groq
    import json
    import os, dotenv
    dotenv.load_dotenv(".env")

    follow_up_data = request.get_json()
    if not follow_up_data:
        return jsonify({"error": "No JSON payload provided"}), 400


    messages.append({
        "role": "system",
        "content": """
            You are in step 2 of the risk analysis process.
            The patient has now provided additional information about their symptoms in response to your follow-up questions.
            Attached below is a list of json objects describing the answers to your follow-up questions.
            Each object contains the following fields:
            {{
                "follow-up-question": "name of the follow-up question",
                "response": " user's response to follow-up",
            }}

            Here is the follow-up data:
            -----------
            {follow_up_data}

            Now you have to make a diagnosis report of what factors based on the symptons could mean that you might be infected with measles. Consider all symptoms provided, and clearly communicate your conclusion of whether the patient may be infected or not. 
            Make a conclusion based on your analysis rather than re-stating the symptons back to the user.
            The report also needs to include precautions to take and health and safety measures to follow. If you feel a patient has 
            a high chance of being infected, you should also include a recommendation of what to do next, such as visiting a clinic. The report must be in a beautiful neatly formatted markdown text.
            Your output should only be a python JSON object with the structure as given to you below. No other
            words or explanations should be included in your output.

            {{
                "risk_analysis_report": "Your risk analysis report here in markdown language",
                "conclusion": "a yes or no answer to the question of whether the patient is infected with measles or not"
            }}
            """.format(follow_up_data=follow_up_data)
    })

    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=messages,
            temperature=1,
            max_completion_tokens=4000,
            response_format={"type": "json_object"},
            top_p=1,
            stream=False,
            stop=None,
        )
        diagnosis = completion.choices[0].message.content
        diagnosis = json.loads(diagnosis)
        #send_to_fetch_agent(diagnosis)
        return diagnosis, 200
    except Exception as e:
        return jsonify({"error": f"Failed in generating diagnosis: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=200, debug=True)
