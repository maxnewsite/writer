# 🎭 9 Personas System - Quick Reference Card

## What Are They?

**9 AI-simulated reader archetypes** that critique each chapter and vote on what to improve.

## When Do They Activate?

**Pass 3 of 6** - After first draft is written, before final revision.

## What Do They Do?

### Step 1: Read the Draft
Each of 9 personas reads the chapter from their perspective.

### Step 2: Ask ONE Question Each
Each persona identifies ONE improvement need:
- What's unclear?
- What's missing?
- What needs more depth?
- What examples would help?

**Result:** 9 questions total

### Step 3: Vote (2 votes each)
Each persona votes for the 2 MOST IMPORTANT questions (can't vote for own).

**Result:** 18 total votes distributed across 9 questions

### Step 4: Select Top 3
Questions are ranked by votes:
```
Question 1: ████████ 6 votes  ← Address this
Question 2: ██████ 5 votes    ← Address this
Question 3: ████ 4 votes      ← Address this
Question 4: ██ 2 votes        ← Skip
Question 5: █ 1 vote          ← Skip
...
```

### Step 5: Revision Uses Top 3
AI rewrites the chapter to specifically address the 3 highest-voted questions.

---

## Two Types of Personas

### Generic (Default)
Used when no book niche specified:
1. The Practitioner
2. The Beginner
3. The Story Seeker
4. The Analyst
5. The Skeptic
6. The Visual Learner
7. The Connector
8. The Philosopher
9. The Efficiency Expert

### Calibrated (Smart!)
Auto-generated based on your book topic.

**Example - Book: "AI in Healthcare"**
1. The Healthcare Professional
2. The Patient Advocate
3. The Data Scientist
4. The Hospital Administrator
5. The Regulatory Expert
6. The Ethicist
7. The Tech Innovator
8. The Medical Student
9. The Healthcare IT Specialist

---

## Complete 6-Pass Process

```
PHASE 0: 🔬 RESEARCH
├─ Web search for current data
├─ Extract statistics, trends, quotes
└─ Cache for 24 hours

PASS 1: 📋 SKELETON
├─ Create chapter structure
└─ Plan where to use research

PASS 2: ✍️ FIRST DRAFT
├─ Write 1000-1500 words
├─ Integrate research naturally
└─ Use clean prose (no bullets)

PASS 3: 🎭 PERSONA CRITIQUE ← PERSONAS ACTIVATE HERE!
├─ Generate 9 calibrated personas (once per book)
├─ Each persona asks 1 question (9 total)
├─ Each persona votes for 2 questions (18 votes)
└─ Select top 3 questions

PASS 4: 🔧 TARGETED REVISION ← PERSONAS IMPACT HERE!
├─ Address question #1 (most votes)
├─ Address question #2
├─ Address question #3
└─ Output: Improved draft

PASS 5: ✨ POLISH
├─ Improve flow and transitions
└─ Clean up formatting

PASS 6: 🚦 QUALITY GATES
├─ Validate word count
├─ Verify questions addressed
└─ Check formatting
```

---

## Impact on Writing

### Before Personas (Pass 2 - First Draft):
```
"AI diagnostic tools are becoming widely adopted in healthcare.
They offer improved accuracy and efficiency."
```

### After Personas (Pass 4 - Revised):
```
"AI diagnostic tools are becoming widely adopted in healthcare,
with **75% of major hospitals** implementing at least one AI system
as of 2024 (Source: HealthTech Report).

**Patient privacy is protected** through HIPAA-compliant encryption
and federated learning approaches. Recent validation studies show
**95% accuracy on diverse patient populations**, with sensitivity
and specificity metrics regularly exceeding human baselines.

For example, Stanford's AI radiology system detected pneumonia
with 0.435 AUC compared to 0.387 for radiologists..."
```

### What Changed?
✅ Added specific statistics (75%, 95%)
✅ Addressed privacy concern (top voted question)
✅ Provided accuracy metrics (top voted question)
✅ Included real example (top voted question)
✅ Bolded key data points

---

## How Questions Flow Between Chapters

```
CHAPTER 1: Introduction
    ↓
Personas ask 9 questions
    ↓
Voting selects top 3:
    1. "How does AI integrate with EHRs?" (6 votes)
    2. "What privacy safeguards exist?" (5 votes)
    3. "What accuracy metrics used?" (4 votes)
    ↓
These 3 questions are PASSED TO CHAPTER 2
    ↓
CHAPTER 2: Technical Foundations
    ↓
AI writer receives:
    "Previous chapter readers wanted to know:
     - How AI integrates with EHRs
     - Privacy safeguards
     - Accuracy metrics
     Address these if relevant to this chapter."
    ↓
Chapter 2 proactively addresses these topics
    ↓
NEW personas ask NEW questions about Chapter 2
    ↓
New top 3 selected, passed to Chapter 3
    ↓
(Continues for entire book)
```

**Result:** Natural narrative flow where later chapters answer earlier questions.

---

## How to Verify It's Working

### 1. Watch Console Logs

During Pass 3, you should see:
```
🎭 Pass 3: Calibrated Persona Critique...
  💬 Generating questions from 9 calibrated personas...
  💬 Generated 9 questions from calibrated personas

  🗳️ Personas voting (2 votes each)...
    📝 Raw vote response:
    The Healthcare Professional votes: 2, 5
    The Patient Advocate votes: 1, 4
    ...

    📋 Found 9 vote lines
      🗳️ Votes: 2 and 5
      🗳️ Votes: 1 and 4
      ... (should see 9 pairs)

    ✅ Total votes cast: 18  ← SHOULD BE ~18!

  ✅ Voting complete!
    1. [The Healthcare Professional] 6 votes: "How would this..."
    2. [The Patient Advocate] 5 votes: "What safeguards..."
    3. [The Data Scientist] 4 votes: "What accuracy..."
```

### 2. Check Vote Count

**Expected:** Total votes ≈ 18 (9 personas × 2 votes)

**If you see 0:** Voting failed, check logs

### 3. Compare Drafts

**Pass 2 output** (first draft) vs **Pass 4 output** (revised)

Should see:
- ✅ More specific details
- ✅ Questions answered
- ✅ Examples added
- ✅ Data included

---

## Common Questions

### Q: Do personas remember previous chapters?
**A:** No. Each chapter gets fresh personas that read ONLY that chapter. But their TOP 3 questions are passed to the next chapter as context.

### Q: Can I customize the personas?
**A:** Not directly, but they auto-calibrate to your book niche. Choose a specific niche for better personas.

### Q: What if voting gives a tie?
**A:** AI still picks top 3. If tie at position 3, first occurrence wins.

### Q: Do personas actually argue/debate?
**A:** No. They independently ask questions, then independently vote. No interaction between personas.

### Q: Why 9 personas specifically?
**A:** MECE principle (Mutually Exclusive, Collectively Exhaustive) - 9 diverse perspectives cover most reader types without overlap.

### Q: What if research has no data?
**A:** Personas can still ask for examples, clarity, depth - not just data. And AI uses its training knowledge.

---

## Best Practices

### ✅ DO:
- Use a specific book niche ("AI in Healthcare" not "Technology")
- Check console for vote counts during writing
- Review top 3 questions - they show what needs work
- Click "View Research Data" to see what informed the chapter

### ❌ DON'T:
- Skip passes (each builds on previous)
- Ignore low vote counts (means voting failed)
- Expect personas to remember earlier chapters directly
- Use too generic a niche (personas become generic too)

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Total votes cast: 0" | AI didn't format votes correctly | Check console "Raw vote response" |
| Generic personas used | No book niche provided | Set book niche when creating |
| Same questions every chapter | Personas not calibrated | Regenerate with clear niche |
| Revision didn't change much | Top questions too similar | Normal if draft was already good |

---

## The Big Picture

```
Research (Phase 0)  →  Provides DATA
         ↓
First Draft (Pass 2)  →  Uses data in content
         ↓
Personas (Pass 3)  →  Identify what's MISSING/UNCLEAR
         ↓
Voting  →  Prioritize MOST IMPORTANT issues
         ↓
Revision (Pass 4)  →  Fill gaps with better explanations
         ↓
Result: Data-backed, reader-focused, comprehensive chapter
```

---

## TL;DR

**9 Personas =** Simulated expert beta readers

**They critique** your first draft by asking questions

**Voting ensures** you address what matters most

**Result:** Chapters that answer real reader needs with current data

**To see it work:** Watch console during "Pass 3: Persona Critique"

**Look for:** "Total votes cast: 18" and top 3 questions

---

Ready to see the magic happen? Start "Full AI Writing" and watch the console! 🎬
