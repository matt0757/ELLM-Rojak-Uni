import os  
from dotenv import load_dotenv        
import time
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from langchain.chat_models import AzureChatOpenAI
from langchain.schema import SystemMessage
from langchain.prompts import PromptTemplate
from langdetect import detect, LangDetectException  # Import language detection library

# Load environment variables
load_dotenv()

# Get Azure OpenAI configuration from environment variables
subscription_key = os.getenv("AZURE_API_KEY")  # Add defaults to avoid errors
endpoint = os.getenv("AZURE_ENDPOINT")
deployment_name = os.getenv("DEPLOYMENT_NAME")

# Initialize Flask app
app = Flask(__name__, static_folder='../frontend')  # Point to frontend directory
CORS(app)  # Enable CORS for all domains on all routes

# Initialize the Azure OpenAI chat model
try:
    chat = AzureChatOpenAI(
        azure_endpoint=endpoint,
        api_key=subscription_key,
        azure_deployment=deployment_name,
        api_version="2025-01-01-preview",
        temperature=0.7,
        max_tokens=800
    )
except Exception as e:
    print(f"Failed to initialize Azure OpenAI: {str(e)}")
    # Create a mock chat function for testing without API keys
    def mock_chat(messages):
        class MockResponse:
            def __init__(self, content):
                self.content = content
        
        # Simple mock response based on language
        language = "en"  # Default
        for msg in messages:
            content = msg.content if hasattr(msg, 'content') else ""
            if "Bahasa Melayu" in content or "dalam Bahasa Melayu" in content:
                language = "ms"
            elif "中文" in content:
                language = "zh"
            elif "தமிழ்" in content:
                language = "ta"
        
        responses = {
            "en": "B) Go to a clinic. You should visit a clinic to get proper evaluation. Your symptoms suggest you need medical attention but it's not an emergency.",
            "ms": "B) Pergi ke klinik. Anda harus pergi ke klinik untuk mendapatkan pemeriksaan yang sesuai. Gejala anda menunjukkan anda memerlukan perhatian perubatan tetapi ia bukan kecemasan.",
            "zh": "B) 去诊所就诊。您应该去诊所接受适当的评估。您的症状表明您需要医疗护理，但这不是紧急情况。",
            "ta": "B) மருத்துவமனைக்குச் செல்லவும். நீங்கள் சரியான மதிப்பீட்டைப் பெற மருத்துவமனைக்குச் செல்ல வேண்டும். உங்கள் அறிகுறிகள் மருத்துவ கவனம் தேவைப்படுவதைக் குறிக்கின்றன, ஆனால் அது அவசரமல்ல."
        }
        
        return MockResponse(responses.get(language, responses["en"]))
    
    # Use mock chat instead
    chat = mock_chat

# Define the medical assistant prompt template with language support
def get_medical_prompt(language_code):
    # Default English prompt
    if language_code == 'en':
        return PromptTemplate(
            input_variables=["symptoms"],
            template="""
            You're a medical assistant in Malaysia. A user says: "{symptoms}". 
            Based on similar past cases, provide advice directly to the user in English. 
            When the user input are irrelevant, do not answer.
            Use "You can..." or "You should..." in your response. 
            A) Stay home and monitor  
            B) Go to a clinic  
            C) Visit the hospital urgently  
            You must respond the choice of A, B, or C and provide a 3 sentence explaination.
            Do not provide any other information.
            """
        )
    elif language_code == 'ms':  # Malay
        return PromptTemplate(
            input_variables=["symptoms"],
            template="""
            Anda adalah pembantu perubatan di Malaysia. Pengguna berkata: "{symptoms}".
            Berdasarkan kes-kes serupa yang lepas, berikan nasihat kepada pengguna dalam Bahasa Melayu.
            Apabila input pengguna tidak relevan, jangan jawab.
            Gunakan "Anda boleh..." atau "Anda harus..." dalam jawapan anda.
            A) Tinggal di rumah dan pantau  
            B) Pergi ke klinik  
            C) Lawat hospital dengan segera  
            Anda mesti memberi pilihan A, B, atau C dan berikan penjelasan ringkas.
            Jangan berikan maklumat lain.
            """
        )
    elif language_code == 'zh':  # Chinese
        return PromptTemplate(
            input_variables=["symptoms"],
            template="""
            您是马来西亚的医疗助手。用户说："{symptoms}"。
            根据类似的过去案例，直接用中文向用户提供建议。
            当用户输入不相关时，请不要回答。
            在您的回答中使用"您可以..."或"您应该..."。
            A) 留在家中并监测  
            B) 去诊所就诊  
            C) 紧急去医院  
            您必须回应选择A、B或C，并提供简短解释。
            不要提供任何其他信息。
            """
        )
    elif language_code == 'ta':  # Tamil
        return PromptTemplate(
            input_variables=["symptoms"],
            template="""
            நீங்கள் மலேசியாவில் உள்ள மருத்துவ உதவியாளர். ஒரு பயனர் கூறுகிறார்: "{symptoms}".
            கடந்த ஒத்த வழக்குகளின் அடிப்படையில், பயனருக்கு நேரடியாக தமிழில் ஆலோசனை வழங்கவும்.
            பயனர் உள்ளீடு தொடர்பற்றதாக இருந்தால், பதிலளிக்க வேண்டாம்.
            உங்கள் பதிலில் "நீங்கள் முடியும்..." அல்லது "நீங்கள் வேண்டும்..." என்ற வார்த்தைகளைப் பயன்படுத்தவும்.
            A) வீட்டில் இருந்து கண்காணிக்கவும்  
            B) மருத்துவமனைக்குச் செல்லவும்  
            C) அவசரமாக மருத்துவமனைக்குச் செல்லவும்  
            நீங்கள் கட்டாயம் A, B, அல்லது C என்ற தேர்வை பதிலளித்து, சுருக்கமான விளக்கம் அளிக்க வேண்டும்.
            வேறு எந்த தகவலையும் வழங்க வேண்டாம்.
            """
        )
    else:  # Default to English for other languages
        return PromptTemplate(
            input_variables=["symptoms"],
            template="""
            You're a medical assistant in Malaysia. A user says: "{symptoms}". 
            Based on similar past cases, provide advice directly to the user in English. 
            When the user input are irrelevant, do not answer.
            Use "You can..." or "You should..." in your response. 
            A) Stay home and monitor  
            B) Go to a clinic  
            C) Visit the hospital urgently  
            You must respond the choice of A, B, or C and provide a brief explanation.
            Do not provide any other information.
            """
        )

# Simple in-memory chat history
chat_history = []

# Function to detect language
def detect_language(text):
    try:
        lang = detect(text)
        # Map similar language codes to our supported ones
        if lang in ['en', 'en-US', 'en-GB']:
            return 'en'
        elif lang in ['ms', 'id']:  # Malay or Indonesian
            return 'ms'
        elif lang in ['zh-cn', 'zh-tw', 'zh']:  # Chinese variants
            return 'zh'
        elif lang == 'ta':  # Tamil
            return 'ta'
        else:
            return 'en'  # Default to English
    except LangDetectException:
        return 'en'  # Default to English if detection fails

# Function to handle medical assistant logic
def get_medical_advice(symptoms, preferred_language=None):
    # Detect language if not explicitly provided
    detected_lang = detect_language(symptoms)
    
    # Use preferred language if provided, otherwise use detected language
    lang_code = preferred_language if preferred_language else detected_lang
    
    # Get the appropriate prompt template for the language
    medical_prompt = get_medical_prompt(lang_code)
    
    # Format the system prompt with the user's symptoms
    system_prompt = medical_prompt.format(symptoms=symptoms)
    
    # Create the system message
    system_message = SystemMessage(content=system_prompt)
    
    # Include the chat history in the conversation
    messages = []
    for entry in chat_history:
        role = entry["role"]
        content = entry["content"]
        messages.append(SystemMessage(content=content) if role == "assistant" else SystemMessage(content=content))
    
    # Add the current system message to the conversation
    messages.append(system_message)
    
    try:
        # Generate a response from the chat model
        response = chat(messages)
        return response.content, lang_code
    except Exception as e:
        print(f"Error generating response: {str(e)}")
        # Fallback responses in case of API failure
        fallback_responses = {
            'en': "B) Go to a clinic. You should consult with a healthcare professional. Your symptoms suggest professional evaluation would be beneficial.",
            'ms': "B) Pergi ke klinik. Anda harus berjumpa dengan profesional kesihatan. Gejala anda mencadangkan penilaian profesional akan memberi manfaat.",
            'zh': "B) 去诊所就诊。您应该咨询医疗专业人员。您的症状表明专业评估将会有益。",
            'ta': "B) மருத்துவமனைக்குச் செல்லவும். நீங்கள் ஒரு சுகாதார நிபுணரை ஆலோசிக்க வேண்டும். உங்கள் அறிகுறிகள் தொழில்முறை மதிப்பீடு பயனுள்ளதாக இருக்கும் என்பதைக் குறிக்கின்றன."
        }
        return fallback_responses.get(lang_code, fallback_responses['en']), lang_code

@app.route('/')
def serve_index():
    return send_from_directory('../frontend', 'Dr.Universal.html')

@app.route('/chat', methods=['POST'])
def chat_endpoint():
    try:
        # Get the message from the request
        data = request.get_json()
        user_message = data.get('message', '')
        language = data.get('language', 'en')

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        # Detect language and get medical advice
        start_time = time.time()
        advice, detected_language = get_medical_advice(user_message, language)

        elapsed_time = time.time() - start_time
        if elapsed_time > 10:  # Timeout check
            return jsonify({"error": "Response took too long. Please try again."}), 504

        # Add to chat history with language tracking
        chat_history.append({"role": "user", "content": user_message, "language": detected_language})
        chat_history.append({"role": "assistant", "content": advice, "language": detected_language})

        # Return the response
        return jsonify({"response": advice, "language": detected_language})

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/history', methods=['GET'])
def get_history():
    """Return the current chat history"""
    return jsonify({"history": chat_history})

@app.route('/clear', methods=['POST'])
def clear_history():
    """Clear the chat history"""
    global chat_history
    chat_history = []
    return jsonify({"status": "Chat history cleared"})

if __name__ == '__main__':
    print("Starting the Medical Assistant Server...")
    print("Access the app at http://localhost:5000")
    app.run(debug=True, port=5000)