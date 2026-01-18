# ExamEcho 🎓✨

## New and Updated version with better, cleaner and a more practical UI, along with better text formatting for mathematical functions & SQL queries, with faster responses.

![ExamEcho Landing Page](App%20Landing%20Page%20Screenshot.png)

## Built in Mini-Hackathon at the end of the Winter School with Python and Gen AI course in collaboration with https://github.com/trehanriishab-arch and https://github.com/bhaveshCosmos

**An AI-powered exam revision + quiz practice companion (built with Google Gemini).**

ExamEcho is a session-based academic practice app that helps students **revise faster**, **practice smarter**, and **track performance** through a structured quiz workflow and a detailed **Cognitive Audit** report.

---

## 🚀 What ExamEcho Does

ExamEcho is designed to simulate an exam-prep session where you can:

### ✅ 1) Upload & Index PDF Notes (RAG-based Study Flow)

- Upload your class notes as a **PDF**
- ExamEcho analyzes the content and prepares it for intelligent questioning
- Automatically detects **top topics / chapters** from your material

### ✅ 2) Generate Structured Study Notes

- Enter any academic topic
- ExamEcho generates a clean revision module with:
  - Executive summary
  - Key concepts
  - Short notes
  - Examples & applications
  - Common mistakes
  - Summary checklist

### ✅ 3) Create Exam-Style Quizzes

You can configure a quiz session with:

- **Quiz Type:** MCQ or Subjective
- **Question Count:** 5 / 10 / 15
- **Difficulty:** Standard / Advanced / Expert
- **Topic Focus:** Full content or a detected sub-topic

### ✅ 4) Attempt Questions in a Clean Quiz Interface

- All questions are shown in a simple exam-like layout
- MCQs contain exactly **4 options (A, B, C, D)**
- Progress indicator shows attempted questions count

### ✅ 5) End Session → Cognitive Audit (Performance Report)

At the end of your session, ExamEcho generates a detailed evaluation:

- ✅ Score & percentage
- ✅ Correct vs incorrect breakdown
- ✅ Model reference answers
- ✅ Tutor insight explanations
- ✅ Evidence chain (grounding-based review)

### ✅ 6) Learning Stats / History Tracking

ExamEcho stores session attempts locally and allows you to revisit past performance through:

- **Learning Stats**
- **History-based Review Mode**

---

## 🛠️ Tech Stack

- **React + TypeScript**
- **Vite**
- **Tailwind CSS**
- **Google Gemini API** using `@google/genai`

---

## 📁 Project Structure

```text
ExamEcho App Code/
├── services/
│   └── geminiService.ts
├── App.tsx
├── index.html
├── index.tsx
├── metadata.json
├── package.json
├── README.md
├── tsconfig.json
├── types.ts
└── vite.config.ts

⚙️ Setup & Run Locally (Windows / Mac / Linux):

✅ 1) Clone the Repository
git clone <YOUR_REPO_LINK>
cd "ExamEcho App Code"

✅ 2) Install Dependencies
npm install

✅ 3) Setup Environment Variables (Gemini API Key)
Create a file named:

✅ .env.local
Inside it, add:
VITE_GEMINI_API_KEY=YOUR_API_KEY_HERE

✅ 4) Start the App
npm run dev
Now open the URL shown in terminal (usually):
http://localhost:5173/

🧪 How to Use ExamEcho: -

✅ Upload PDF Notes:
Click Upload PDF Notes,
Upload a standard PDF file,
Wait for indexing to complete,
Proceed to quiz configuration

✅ Generate a Revision Module:
Enter a topic in the Module Generator input,
Click Draft Module,
Review the generated study notes,
Configure a quiz session from the content

✅ Start Practice Session
Choose:
Focus module (topic),
quiz type,
question count,
difficulty level,
Click Initiate Practice,
Attempt the quiz

✅ End Session & Get Cognitive Audit:
Click End Session,
View your: Score and feedback with explanations and evidence chain.

✅ View Past Attempts:
Click Learning Stats from the top navigation bar to view quiz history.

🔐 API Key Security:
This project requires a Gemini API key, but your key is safe if you follow these rules:

✅ Keep your key only inside:
.env.local

📌 Notes / Known Limitations
PDF performance depends on document quality,
scanned PDFs may not index as well as text-based PDFs,
Very frequent requests may trigger Gemini rate-limiting (HTTP 429),
waiting a few seconds and trying again resolves it
```

### 🏆 Hackathon Highlight

### ExamEcho was built as a mini-hackathon project and secured:

### 🥈 2nd Position — Winter School on Python with Gen AI

### Special thanks to the judges - https://github.com/Jaskirat-singh04 and https://github.com/Tush-hub for guiding and being mentors throughout the project.

## 👤 Author - Kunsh Sabharwal
