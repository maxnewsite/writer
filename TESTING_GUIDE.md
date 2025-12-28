# Testing Guide: Research-Enhanced Writing System

## ✅ Pre-Flight Checklist

### 1. AI Provider Running
- [ ] Ollama is running on `http://localhost:11434` OR
- [ ] LM Studio is running on `http://localhost:1234`

Test connection:
```bash
# For Ollama
curl http://localhost:11434/api/tags

# For LM Studio
curl http://localhost:1234/v1/models
```

### 2. Dev Server Running
- [✓] Server running at: `http://localhost:5174`
- Open in browser: http://localhost:5174

---

## 🧪 Testing the Complete Writing Flow

### Test Scenario: Create a Technology Book with Research

#### Step 1: Navigate to Settings (First Time)
1. Open http://localhost:5174/settings
2. Verify AI provider is connected (green checkmark)
3. If not connected, check that Ollama/LM Studio is running

#### Step 2: Create a New Book
1. Go to Dashboard: http://localhost:5174
2. Click "Create New Book"
3. Enter niche: **"Artificial Intelligence and Machine Learning"**
4. Click "Generate Ideas"
5. Wait for AI to generate 5 book ideas (~10-30 seconds)
6. Select an idea (or use default)
7. Click "Generate Outline"
8. Wait for AI to create chapter outline (~20-40 seconds)
9. Review outline (should have ~10 chapters)
10. Click "Create Book"

**Expected Result:** Book created and redirected to Dashboard

#### Step 3: Start AI Writing with Research
1. From Dashboard, click on your newly created book
2. Click "Full AI Writing" button
3. Watch the progress indicator

**Critical Research Verification Points:**

Watch console logs for each chapter:
```
🔬 Phase 0: Conducting real-time research...
  📋 Key topics identified: [topic1, topic2, topic3]
    ✓ Found X findings for "topic"
  ✅ Research complete: X statistics, Y trends
  💾 Research saved to database
```

**Expected Timeline per Chapter:**
- Research Phase: 5-15 seconds (web searches + AI synthesis)
- Skeleton: 10-20 seconds
- First Draft: 30-60 seconds
- Persona Critique: 20-30 seconds
- Revision: 30-50 seconds
- Polish: 20-30 seconds
- Quality Gates: 10-20 seconds
- **Total: 2-4 minutes per chapter**

#### Step 4: Verify Research Integration

After writing completes, check a chapter:

1. Click on any completed chapter
2. Look for:
   - **Statistics with sources**: e.g., "According to recent research, **73% of organizations** have adopted AI..."
   - **Bolded key statistics**
   - **Current year references**: Should mention 2024 or 2025
   - **Source citations**: "Studies show that..."
   - **Trend mentions**: "Current trends indicate..."

**Red Flags (should NOT see):**
- ❌ Outdated statistics from 2020 or earlier
- ❌ No numbers or data points
- ❌ Generic statements without specifics
- ❌ No bolded statistics

#### Step 5: Check Research Cache

Open browser DevTools → Application → IndexedDB → book-writer → chapter_research

**Expected:**
- One entry per chapter written
- Contains: key_statistics, recent_trends, notable_quotes
- researched_at: Current timestamp
- expires_at: 24 hours from now

---

## 🔬 Testing Research Service Directly

### Test 1: Basic Research Query

Open browser console at http://localhost:5174 and run:

```javascript
// Import research service
const { researchService } = await import('./src/services/researchService.ts')

// Test research for a tech topic
const research = await researchService.researchForChapter(
  'Introduction to Neural Networks',
  'An overview of neural network fundamentals and applications',
  'Machine Learning',
  'AI Fundamentals',
  (status) => console.log('Status:', status)
)

console.log('Research Results:', research)
console.log('Statistics:', research.keyStatistics)
console.log('Trends:', research.recentTrends)
```

**Expected Output:**
```javascript
{
  chapterTitle: "Introduction to Neural Networks",
  bookNiche: "Machine Learning",
  summary: "Research gathered... [AI-generated summary]",
  keyStatistics: [
    "Neural networks have grown 300% in adoption... (Source: TechReport, 2024)",
    "The AI market is expected to reach $190 billion..."
  ],
  recentTrends: [
    "Transformer architectures dominating NLP applications",
    "Increased focus on energy-efficient neural networks"
  ],
  notableQuotes: [...],
  suggestedCitations: [...]
}
```

### Test 2: Research Caching

Run the same query twice:

```javascript
// First call - should search web
console.time('First call')
const research1 = await researchService.researchForChapter(
  'Chapter on AI Ethics',
  'Exploring ethical considerations in AI',
  'Artificial Intelligence',
  'AI Book'
)
console.timeEnd('First call')

// Second call - should use cache
console.time('Second call (cached)')
const research2 = await researchService.researchForChapter(
  'Chapter on AI Ethics',
  'Exploring ethical considerations in AI',
  'Artificial Intelligence',
  'AI Book'
)
console.timeEnd('Second call (cached)')
```

**Expected:**
- First call: 5-15 seconds
- Second call: <100ms (cached)
- Both return identical data

### Test 3: Research API Endpoints

Test the search APIs directly:

```javascript
// Test DuckDuckGo API
const ddgUrl = 'https://api.duckduckgo.com/?q=AI%20statistics%202025&format=json'
const response = await fetch(ddgUrl)
const data = await response.json()
console.log('DuckDuckGo Response:', data)

// Test Wikipedia API
const wikiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/Artificial_intelligence'
const wikiResp = await fetch(wikiUrl)
const wikiData = await wikiResp.json()
console.log('Wikipedia Summary:', wikiData.extract)
```

**Expected:**
- Both APIs should return data
- No CORS errors
- JSON responses

---

## 🐛 Common Issues & Solutions

### Issue 1: Research Phase Failing
**Symptom:** Console shows "Research failed, using training data only"

**Solutions:**
1. Check internet connection
2. Try opening https://api.duckduckgo.com in browser
3. Verify no corporate firewall blocking API calls
4. Check browser console for CORS errors

### Issue 2: No Statistics in Generated Content
**Symptom:** Chapters written but no data points

**Possible Causes:**
1. Research found no data (check console for "0 statistics, 0 trends")
2. AI model not integrating research (check if research context passed to prompts)
3. Topic too niche for public data

**Debug:**
```javascript
// Check if research data exists in DB
const db = await import('./src/services/database.ts')
const dbInstance = await db.getDatabase()
const allResearch = await dbInstance.getAll('chapter_research')
console.log('All Research:', allResearch)
```

### Issue 3: Slow Research Phase
**Symptom:** Research takes >30 seconds per chapter

**Solutions:**
1. Normal for first run (no cache)
2. Subsequent chapters should use cache when topics overlap
3. API rate limiting - wait a moment between chapters
4. Use smaller topic searches (fewer than 3 topics per chapter)

### Issue 4: Database Migration Issues
**Symptom:** Error about missing 'chapter_research' table

**Solution:**
Clear IndexedDB and reload:
```javascript
// In browser console
indexedDB.deleteDatabase('book-writer')
location.reload()
```

---

## 📊 Success Criteria

Your implementation is working correctly if:

✅ **Research Phase:**
- [✓] Research runs before each chapter
- [✓] Finds 2-5+ statistics per chapter
- [✓] Identifies current trends
- [✓] Caches results in database
- [✓] Reuses cache for subsequent runs

✅ **Writing Quality:**
- [✓] Chapters contain **bolded statistics**
- [✓] Citations like "According to recent research..."
- [✓] Current year data (2024-2025)
- [✓] Real numbers and percentages
- [✓] Source attributions

✅ **Performance:**
- [✓] Research: 5-15 seconds (first time)
- [✓] Research: <1 second (cached)
- [✓] Total chapter: 2-4 minutes
- [✓] Full 10-chapter book: 20-40 minutes

✅ **Data Persistence:**
- [✓] Research saved to IndexedDB
- [✓] Expires after 24 hours
- [✓] Survives page refreshes
- [✓] One entry per chapter

---

## 🎯 Recommended Test Flow

**Quick Test (5 minutes):**
1. Create book on a current topic (e.g., "AI in 2025")
2. Write ONE chapter with Full AI Writing
3. Verify research logs in console
4. Check chapter contains statistics

**Full Test (30-45 minutes):**
1. Create complete book outline (10 chapters)
2. Run Full AI Writing for all chapters
3. Monitor research phase for each chapter
4. After completion:
   - Read 3 random chapters
   - Verify statistics present
   - Check IndexedDB for research data
   - Verify cache reuse in logs

**Stress Test:**
1. Create 3 books in different niches
2. Write all chapters
3. Verify research adapts to each niche
4. Check database doesn't grow excessively

---

## 📝 Sample Output to Verify

### Good Chapter Example (with Research):

> ## Introduction to Deep Learning
>
> Deep learning has revolutionized artificial intelligence over the past decade. **According to recent industry reports, the deep learning market is projected to reach $93 billion by 2026**, representing a compound annual growth rate of over 35%. This explosive growth reflects the technology's impact across numerous industries.
>
> Current trends show that **transformer architectures now dominate natural language processing**, accounting for the majority of state-of-the-art results in translation, summarization, and text generation. Studies indicate that **over 80% of Fortune 500 companies** have integrated some form of deep learning into their operations...

### Bad Chapter Example (no Research):

> ## Introduction to Deep Learning
>
> Deep learning is an important technology in artificial intelligence. It uses neural networks to process data. Many companies use deep learning for various applications. It has been growing in popularity over the years...
>
> (Notice: No statistics, no current data, no sources, generic statements)

---

## 🚀 Ready to Test?

1. **Verify AI is running**: curl http://localhost:11434/api/tags
2. **Open app**: http://localhost:5174
3. **Create a book** on a current topic (AI, Climate Tech, Remote Work, etc.)
4. **Watch the logs** for research phase
5. **Verify statistics** in generated content

**Expected log sequence per chapter:**
```
🔄 Starting Multi-Pass Writing for Chapter 1: Introduction

🔬 Phase 0: Conducting real-time research...
  📋 Key topics identified: deep learning, neural networks, AI
    ✓ Found 8 findings for "deep learning Machine Learning"
    ✓ Found 6 findings for "neural networks Machine Learning"
  ✅ Research complete: 5 statistics, 4 trends
  💾 Research saved to database

📋 Pass 1: Generating skeleton/structure...
  ✓ Skeleton complete (487 chars)

✍️ Pass 2: Writing first draft...
  ✓ First draft complete (6543 chars, ~1205 words)

🎭 Pass 3: Calibrated Persona Critique...
  💬 Generated 9 questions from calibrated personas
  🗳️ Personas voting (2 votes each)...
  ✓ Critique complete - 9 questions, top 3 selected

✏️ Pass 4: Revision based on feedback...
  ✓ Revision complete (6891 chars)

✨ Pass 5: Final polish and style...
  ✓ Polish complete (7123 chars)

📊 Pass 6: Quality Gates...
  Gate 1: Word Count - ✓ PASSED (1289 words >= 800)
  Gate 2: Questions Addressed - ✓ PASSED
  Gate 3: Depth & Examples - ✓ PASSED
  Gate 4: Clean Formatting - ✓ PASSED
  ✅ Overall Quality: PASSED (8/8 points)

✅ Multi-Pass Writing Complete for Chapter 1!
  📊 Research integrated: 5 statistics, 4 trends
```

Happy Testing! 🎉
