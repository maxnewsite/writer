# 📚 Book Writer

A collaborative book writing application powered by local AI (Ollama). Write books that evolve based on reader feedback.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-blue.svg)](./RELEASE_NOTES.md)
[![Status: MVP](https://img.shields.io/badge/Status-MVP-green.svg)]()

---

## ✨ Features

### 📝 AI-Assisted Writing
- **Niche-based book ideas** from AI (5 concepts to choose from)
- **Intelligent outlines** with chapter structure
- **Auto-save** every 3 seconds (no manual saving needed)
- **AI writing prompts** generated from reader questions

### 💬 Collaborative Feedback
- **Reader Q&A** - Readers ask questions about chapters
- **Voting system** - Upvote important questions
- **Author responses** - Answer questions publicly
- **Feedback loop** - Top questions become writing prompts

### 🔒 Privacy-First
- ✅ All data stored locally (SQLite)
- ✅ Local AI (Ollama) - no cloud APIs
- ✅ No tracking, no subscriptions
- ✅ Fully offline (except for Ollama setup)

### 🏗️ Built for Simplicity
- **Single user** MVP (perfect for individual authors)
- **Markdown editor** with preview
- **3-panel interface** (chapters, editor, Q&A)
- **Settings screen** for Ollama configuration

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ - [Install](https://nodejs.org/)
- **Ollama** - [Install](https://ollama.ai)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/book-writer.git
cd book-writer

# Install dependencies
npm install

# Build the application
npm run build

# Start development server
npm run dev
```

### First Steps

1. Make sure Ollama is running: `ollama serve`
2. Pull a model: `ollama pull mistral`
3. Launch Book Writer
4. Go to ⚙️ Settings → Click "Test Connection"
5. Create your first book! ✨

📖 **Full setup guide**: See [`claudedocs/SETUP_GUIDE.md`](./claudedocs/SETUP_GUIDE.md)

---

## 📖 How It Works

### 1. Create Your Book
```
Enter Niche → AI Generates Ideas → Choose & Customize → Get Outline
```

### 2. Write Chapters
- Follow the AI outline or write your own
- Auto-save handles persistence
- Switch between chapters easily

### 3. Get Reader Feedback
- Readers ask questions
- Community votes on important questions
- View top questions in your Q&A panel

### 4. Improve with AI Prompts
- Click 💡 **AI Prompt** button
- AI analyzes top questions
- Generates writing prompt for next chapter
- Incorporate feedback naturally

---

## 🏗️ Architecture

```
┌─ Desktop App (Electron) ─────────────────────┐
│                                              │
│  ┌─ Main Process (Node.js) ─────────────┐   │
│  │ ├─ SQLite Database                   │   │
│  │ ├─ Ollama Service                    │   │
│  │ └─ IPC Handlers                      │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌─ Renderer (React) ───────────────────┐   │
│  │ ├─ Dashboard                         │   │
│  │ ├─ Book Setup Wizard                 │   │
│  │ ├─ Chapter Writing Interface         │   │
│  │ ├─ Q&A Panel                         │   │
│  │ └─ Settings Screen                   │   │
│  └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
         ↓ (IPC Communication)
    Ollama Service (localhost:11434)
```

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Desktop**: Electron 27 + electron-vite
- **Database**: SQLite + better-sqlite3
- **State**: Zustand
- **Styling**: TailwindCSS
- **AI**: Ollama (local HTTP)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [SETUP_GUIDE.md](./claudedocs/SETUP_GUIDE.md) | Complete user guide + troubleshooting |
| [TESTING_CHECKLIST.md](./claudedocs/TESTING_CHECKLIST.md) | Test coverage + quality assurance |
| [RELEASE_NOTES.md](./RELEASE_NOTES.md) | What's new in v1.0.0 |
| Source code | Well-commented TypeScript |

---

## 🎯 Use Cases

### ✍️ Solo Authors
- Write your next book with AI assistance
- Get real feedback from readers
- Iterate based on audience input

### 📚 Course Creation
- Outline course chapters with AI
- Get student questions
- Refine content based on confusion points

### 📖 Collaborative Writing
- Write about your expertise
- Let readers guide your topics
- Build engaged community around your work

### 🔬 Research Documentation
- Generate documentation outlines
- Gather feedback from users
- Improve explanations iteratively

---

## 🔧 Development

### Available Commands

```bash
# Development
npm run dev           # Start dev server with HMR

# Building
npm run build         # Production build
npm run start         # Run production build

# Quality
npm run typecheck     # TypeScript type checking
npm run lint          # Linting (if configured)

# Version
npm run version       # Show versions
```

### Project Structure

```
book-writer/
├── src/
│   ├── main/              # Electron main process
│   │   ├── database/      # SQLite setup
│   │   ├── services/      # Business logic (OllamaService, etc)
│   │   └── ipc/          # IPC handlers
│   ├── preload/          # IPC context bridge
│   └── renderer/         # React application
│       ├── src/
│       │   ├── views/    # Page-level components
│       │   ├── components/
│       │   ├── store/    # Zustand stores
│       │   └── styles/   # CSS
├── claudedocs/           # Documentation
├── RELEASE_NOTES.md      # What's new
└── README.md             # This file
```

### Building from Source

```bash
# Clone
git clone <repo>
cd book-writer

# Install & build
npm install
npm run build

# Run
npm run dev    # Dev mode
npm run start  # Production mode
```

---

## 🐛 Troubleshooting

### Ollama Not Connecting?
1. Make sure Ollama is running: `ollama serve`
2. Check it's accessible: `curl http://localhost:11434/api/tags`
3. Go to ⚙️ Settings → Test Connection

### No Models Available?
1. Pull a model: `ollama pull mistral`
2. Verify: `ollama list`
3. Refresh settings or restart app

### Generation Failing?
1. Check Ollama is running
2. Check you have enough disk space
3. Try a smaller model
4. Check browser console for errors (F12)

📖 Full troubleshooting: [`SETUP_GUIDE.md` Troubleshooting section](./claudedocs/SETUP_GUIDE.md#-troubleshooting)

---

## 📊 Performance

- **App launch**: ~3-5 seconds
- **Dashboard load**: ~1-2 seconds
- **Auto-save**: Every 3 seconds (configurable)
- **Renderer bundle**: 338 kB (gzipped: ~80 kB)
- **Memory usage**: ~200-500 MB (depending on usage)

---

## 🔐 Privacy & Security

### Privacy
✅ **All data stays on your machine**
- SQLite database: `~/.book-writer/app.db`
- No cloud uploads
- No tracking or analytics
- No authentication needed (single-user)

### Security Notes
⚠️ **Current limitations (MVP)**:
- Database not encrypted
- No password protection
- Local Ollama assumes trusted network

**Recommendations**:
- Regular backups of your database
- Keep Ollama updated
- Run Ollama only when needed

---

## 🚀 Roadmap

### v1.1
- [ ] PDF/EPUB export
- [ ] Rich text editor option
- [ ] Analytics dashboard
- [ ] Chapter templates

### v1.2
- [ ] Better markdown rendering
- [ ] Spell/grammar checking
- [ ] Advanced Ollama customization

### v2.0
- [ ] Multi-user collaboration
- [ ] Real-time updates
- [ ] Cloud backup (optional)
- [ ] Mobile reading

---

## 🤝 Contributing

Contributions welcome! Please:

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style
- Add TypeScript types
- Test your changes
- Update documentation if needed

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details

---

## 💬 Support

### Issues & Bugs
Report via [GitHub Issues](https://github.com/yourusername/book-writer/issues)

### Questions & Discussions
Ask in [GitHub Discussions](https://github.com/yourusername/book-writer/discussions)

### Feature Requests
Submit in [GitHub Discussions](https://github.com/yourusername/book-writer/discussions)

---

## 🙌 Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Ollama](https://ollama.ai/)
- [SQLite](https://www.sqlite.org/)

Inspired by collaborative writing, local-first principles, and AI-assisted creation.

---

## 📞 Contact

- **GitHub**: [@yourusername](https://github.com/yourusername)
- **Email**: contact@example.com
- **Website**: yourwebsite.com

---

## 🎉 Getting Started

Ready to write?

```bash
npm install && npm run dev
```

Then visit the [SETUP_GUIDE](./claudedocs/SETUP_GUIDE.md) for complete instructions.

**Happy writing! 📚✨**

---

**Current Version**: 1.0.0 (MVP)
**Last Updated**: December 26, 2025
**Status**: Active Development
