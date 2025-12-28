# Book Writer - Complete Setup & User Guide

## 📚 What is Book Writer?

Book Writer is a collaborative book writing application powered by local AI (Ollama). It helps authors create books through an interactive feedback loop:

1. **AI generates book ideas** for your niche
2. **You write chapters** following an AI-generated outline
3. **Readers ask questions** about your chapters
4. **Top questions become writing prompts** for your next chapter
5. **You iterate** based on reader feedback

No cloud APIs, no subscriptions - everything runs locally on your machine.

---

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** 18+ (download from [nodejs.org](https://nodejs.org/))
- **Ollama** (download from [ollama.ai](https://ollama.ai))
- **Git** (optional, for cloning the repository)

### Step 1: Clone/Download the Project

```bash
git clone https://github.com/yourusername/book-writer.git
cd book-writer
```

Or download as ZIP and extract.

### Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages:
- Electron (desktop framework)
- React 18 (UI framework)
- SQLite (local database)
- Zustand (state management)
- TailwindCSS (styling)

### Step 3: Verify Installation

```bash
npm run typecheck
```

Should complete with no errors.

---

## 🤖 Setting Up Ollama

### What is Ollama?

Ollama runs large language models on your local machine. No API keys, no rate limits, no data sent to the cloud.

### Installation

1. **Download Ollama** from [ollama.ai](https://ollama.ai)
2. **Install** for your operating system (Mac, Windows, Linux)
3. **Launch the Ollama application**

### Pulling a Model

Open a terminal and run:

```bash
ollama pull mistral
```

This downloads the Mistral model (~4GB). First run takes 5-10 minutes depending on your internet speed.

**Available models** (smaller = faster, larger = better quality):
- `mistral` - **Recommended for MVP** (7B params, fast, good quality)
- `neural-chat` - Optimized for conversations (7B params)
- `llama2` - Well-known, general purpose (7B params)
- `llama2:13b` - Larger, better quality but slower (13B params)

### Verify Ollama is Running

```bash
curl http://localhost:11434/api/tags
```

Should return a JSON list of available models. If it doesn't work, make sure:
- Ollama application is open and running
- No firewall is blocking port 11434

---

## ▶️ Running the Application

### Development Mode (for testing/development)

```bash
npm run dev
```

This starts the app with live reload. Changes to code reflect instantly.

### Production Build (final release)

```bash
npm run build
npm run start
```

---

## 📖 How to Use Book Writer

### Dashboard (Home Screen)

When you launch the app, you see the Dashboard showing:

- **Ollama connection status** (🟢 green = connected, 🟡 yellow = not running)
- **Your books** (grid of book cards)
- **Create New Book button** (blue)

### Creating a New Book (3-Step Wizard)

#### Step 1: Define Your Niche

```
"What's your book's niche?"
```

Examples:
- "Productivity for software developers"
- "Beginner vegan cooking"
- "Startup scaling strategies"

Click **✨ Generate Book Ideas** → AI generates 5 unique book ideas for your niche.

#### Step 2: Select & Customize Your Idea

The AI presents 5 ideas. Each shows:
- **Title** (main idea name)
- **Hook** (why this book matters)
- **Target Audience** (who should read it)
- **Key Themes** (main topics)

**Click an idea** to select it. You can refine the hook before proceeding.

Click **📚 Generate Outline** → AI creates a detailed chapter-by-chapter outline.

#### Step 3: Review Your Outline

AI generates 10 chapters with titles and descriptions. Review and adjust if needed.

Click **✅ Create Book & Start Writing** → Book is created and you enter the writing workspace.

### Writing Interface (ChapterWork)

The workspace has **3 panels**:

```
┌─────────────┬──────────────────────┬──────────────────┐
│             │                      │                  │
│  Chapters   │    Editor            │   Questions      │
│  (Left 20%) │    (Center 50%)      │   (Right 30%)    │
│             │                      │                  │
└─────────────┴──────────────────────┴──────────────────┘
```

#### Left Panel: Chapter Navigator

- **List of all chapters** from your outline
- **Click a chapter** to open it for editing
- **Status badges**: 🚀 Draft, ✅ Published, 📎 Archived
- **+ Add Chapter** button to create new chapters

#### Center Panel: Markdown Editor

- **Write your chapter** in markdown format
- **Auto-save** (every 3 seconds, no manual save needed)
- **Status indicator**: "Saving..." → "✓ Saved" → "Idle"
- **📊 Word/character count** at bottom
- **Preview button** (👁️) to see formatted text
- **💡 AI Prompt button** to generate prompts from top questions

#### Right Panel: Reader Q&A

- **Reader questions** about your chapter
- **Vote buttons** (▲) to upvote questions
- **Sort options**: Top Voted, Recent
- **Answer form** to respond to questions (as Author or Reader)
- **Status badges** showing if question is answered or incorporated

### The Feedback Loop Workflow

1. **Publish a chapter** (📤 button)
2. **Readers ask questions** via "+ Ask Question" form
3. **Questions get voted on** (▲ button)
4. **View top questions** in the Q&A panel
5. **Click 💡 AI Prompt** → AI analyzes top 5 questions
6. **See generated writing prompt** in purple panel
7. **Click "Apply to Chapter"** → Prompt prepends to next chapter
8. **Write next chapter** incorporating feedback

This creates a dynamic loop where reader input shapes your writing.

### Answering Questions

Authors and readers can answer questions:

1. **Expand a question** by clicking it
2. **Scroll down** to answer form
3. **Type answer** in textarea
4. **Check "Post as Author"** if you're the book author
5. **Click "✓ Answer"** to submit

---

## ⚙️ Settings

Click **⚙️ Settings** in the top right to access:

### Ollama Configuration

- **Connection Status**: Shows if Ollama is running
- **Test Connection**: Button to verify Ollama is accessible
- **Model Selection**: Choose which AI model to use
- **Setup Instructions**: If Ollama isn't connected

### Recommended Settings for MVP

- **Model**: `mistral` (fastest, good quality)
- **Connection**: Should show green ✅
- Run through troubleshooting if yellow ⚠️

---

## 📝 Writing Tips

### Markdown Format

The editor supports markdown. Examples:

```markdown
# Chapter Title
## Section 1
### Subsection

This is regular text.

- Bullet point 1
- Bullet point 2
- Bullet point 3

1. Numbered item
2. Another item

**Bold text** and *italic text*

> Blockquote
> for emphasis
```

### Iterating Based on Feedback

1. **Read top-voted questions** (sort by "Top Voted")
2. **Click 💡 AI Prompt** button
3. **Review the generated writing prompt**
4. **Consider reader concerns** in your outline
5. **Write next chapter** incorporating answers
6. **Update previous chapter** if needed (new version)

---

## 🔧 Troubleshooting

### "Ollama is not connected" (yellow warning)

**Problem**: Yellow status on dashboard, Settings show ❌

**Solutions**:
1. Make sure Ollama application is running (check system tray/menu bar)
2. Check firewall isn't blocking port 11434
3. Try: `curl http://localhost:11434/api/tags` in terminal
4. Restart Ollama application
5. Restart Book Writer

### "No models available" in Settings

**Problem**: Connected to Ollama but no models show up

**Solutions**:
1. Pull a model: `ollama pull mistral`
2. Verify with: `ollama list`
3. Refresh Settings page
4. Restart Book Writer

### "Generation failed" when creating ideas/outline

**Problem**: Click Generate but get an error

**Solutions**:
1. Verify Ollama is running: `ollama serve` in terminal
2. Check your niche input (try shorter, simpler descriptions)
3. Check available disk space (models are large)
4. Try a smaller model: `ollama pull neural-chat`
5. Check browser console (F12) for detailed error

### App crashes or freezes

**Problem**: Application becomes unresponsive

**Solutions**:
1. **Don't force quit immediately** - give it 30 seconds
2. If still frozen, force quit and restart
3. Check database file isn't corrupted:
   - Find database at `~/.book-writer/app.db`
   - Rename to `app.db.backup`
   - Restart app (new database created)
   - Your books are lost, but app recovers
4. Check system resources (disk, RAM)

### Can't answer questions or vote

**Problem**: Buttons don't respond or error appears

**Solutions**:
1. Refresh the page (Cmd/Ctrl + R)
2. Check your internet connection (if using Ollama over network)
3. Check database permissions
4. View console errors (F12 → Console tab)

---

## 📊 Database & Data Storage

### Where is my data?

All data is stored locally in SQLite:

**Windows**: `C:\Users\[YourName]\AppData\Local\book-writer\`
**Mac**: `~/Library/Application Support/book-writer/`
**Linux**: `~/.local/share/book-writer/`

Database file: `app.db`

### Backing up your work

1. **Locate database folder** (see above)
2. **Copy `app.db` file** to external drive or cloud storage
3. **Do this regularly** - no automatic backups yet

### Restoring from backup

1. Close Book Writer
2. Replace `app.db` with your backup
3. Restart Book Writer

---

## 🎯 Workflow Examples

### Example 1: Single Book MVP

```
Day 1: Create book "Python for Writers"
  - Niche: "Teaching Python to non-programmers"
  - Generate ideas → Select one → Generate outline

Day 2-5: Write first 3 chapters
  - Chapter 1: Introduction to Python
  - Chapter 2: Variables and Data Types
  - Chapter 3: Control Flow

Day 6: Publish chapters, collect feedback
  - Readers ask questions about confusing sections

Day 7-10: Iterate
  - View top questions
  - Generate AI prompts from feedback
  - Write remaining chapters incorporating feedback
```

### Example 2: Collaborative Feedback Loop

```
You: Publish Chapter 1
Reader A: "What's the difference between lists and tuples?"
Reader B: "Can you explain this with more examples?"
Reader C: Votes on Reader B's question

You: Click 💡 AI Prompt
System: Generates writing prompt incorporating top 2 questions
You: Write Chapter 2 with more examples + list/tuple comparison

You: Publish Chapter 2
Readers: Can now see your response to their questions
Reader B: "Thanks, that makes sense now!" (in answer)
```

---

## 🔐 Privacy & Security

### Local-First Architecture

- ✅ All data stays on your machine
- ✅ No cloud APIs, no tracking
- ✅ Ollama runs locally, no external API calls
- ✅ No user authentication needed (single-user MVP)

### Best Practices

1. **Regular backups** of your `app.db` file
2. **Keep Ollama updated** (`ollama pull` latest models)
3. **Use strong ideas** - smaller models can generate generic content
4. **Iterate with feedback** - AI works best when guided by readers

---

## 🚀 Advanced Usage

### Using Different Models

Larger models produce better content but are slower:

```bash
ollama pull llama2:13b    # Better quality, slower
ollama pull mistral       # Balanced (recommended)
ollama pull neural-chat   # Fast, conversational
```

Then select in ⚙️ Settings → Model Selection

### Creating Multiple Books

1. Go to Dashboard
2. Click **✨ Create New Book** multiple times
3. Each book has separate chapters and discussions
4. Switch between books via Dashboard

### Exporting Content

Currently, chapters are stored in SQLite. To export:

1. Open database viewer (DB Browser for SQLite)
2. Find `chapter_versions` table
3. Copy content column
4. Paste into Word/Google Docs

(Auto-export feature planned for future)

---

## 📋 Limitations & Future Features

### Current Limitations (MVP)

- Single user (no multi-user collaboration yet)
- No real-time chat (only Q&A threads)
- No rich text editor (markdown only)
- No chapter templates or styles
- No analytics/metrics yet

### Planned Features

- [ ] Real-time collaboration
- [ ] Rich text editor
- [ ] Export to PDF/EPUB
- [ ] Analytics dashboard
- [ ] Reader reviews
- [ ] Chapter versioning with diff view
- [ ] Integration with external services

---

## 💬 Support & Community

### Getting Help

1. **Check Troubleshooting section** above
2. **View error logs**: Look in console (F12)
3. **Create an issue** on GitHub with:
   - What you were doing
   - Error message (if any)
   - Operating system and version
   - Ollama model you're using

### Reporting Bugs

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshot (if visual issue)
- System info (`npm run version`)

---

## 📚 Architecture Overview

For developers interested in the codebase:

```
Desktop (Electron)
├── Main Process (Node.js)
│   ├── SQLite Database
│   ├── Ollama Service
│   └── IPC Handlers
├── Preload Script (secure bridge)
└── Renderer (React)
    ├── Views (Dashboard, BookSetup, ChapterWork, Settings)
    ├── Components (Editor, Q&A, ChapterList)
    └── State (Zustand stores)
```

**Key Technologies**:
- Framework: Electron + electron-vite
- Frontend: React 18 + TypeScript
- State: Zustand
- Database: SQLite + better-sqlite3
- Styling: TailwindCSS
- LLM: Ollama (local, HTTP API)

---

## 📖 Examples & Templates

### Good Book Niche Examples

- "Machine Learning for High School Students"
- "Sustainable Entrepreneurship in Emerging Markets"
- "Mental Health Awareness for Tech Teams"
- "Cooking with Seasonal Local Ingredients"

### Writing Tips for AI Collaboration

1. **Be specific** in your niche ("Data Science" → "Data Science for Marketing Teams")
2. **Answer all feedback** - readers appreciate responsiveness
3. **Iterate quickly** - write 3 chapters, get feedback, refine
4. **Use AI prompts as inspiration**, not gospel
5. **Add personal experiences** - AI generates structure, you add soul

---

## ✅ Success Checklist

Before you start writing:

- [ ] Ollama installed and running
- [ ] At least one model pulled (`ollama list` shows models)
- [ ] Book Writer installed and dependencies installed
- [ ] ⚙️ Settings shows ✅ Connected
- [ ] You can create a test book without errors

Ready to write! 🚀

---

**Last Updated**: December 2025
**Version**: 1.0.0 (MVP)
**Author**: Book Writer Development Team
