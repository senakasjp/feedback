# OpenAI RAG Architecture for AI-Assisted Academic Marking

## Overview

This document describes a recommended architecture for building an
AI-assisted marking system using the OpenAI API with Retrieval Augmented
Generation (RAG). The system combines:

-   Stable **developer prompts**
-   **Vector store retrieval** for rubric and exemplar material
-   **Student submission input**
-   **Structured JSON output** for consistent grading

This architecture is suitable for automated or semi‑automated marking
workflows in higher education.

------------------------------------------------------------------------

# System Architecture

## Three Layer Design

### 1. Stable Instructions (Developer Prompt)

These instructions control model behaviour and should appear in every
request.

Include:

-   Role of the assessor
-   Marking principles
-   Grade boundaries
-   Required output format
-   Moderation rules
-   Academic integrity rules
-   Language rules (e.g., British English)

These instructions should remain **stable across all requests** to
enable prompt caching and consistent behaviour.

------------------------------------------------------------------------

### 2. Retrieval Layer (Vector Store / RAG)

Store larger reference materials in a vector database.

Examples:

-   Full marking rubrics
-   Detailed criterion descriptions
-   Model answers
-   High‑quality exemplar submissions
-   Medium‑quality exemplar submissions
-   Weak exemplar submissions
-   Moderation guidelines
-   Assignment briefs
-   Relevant course notes

The retrieval system should return only the **most relevant chunks** for
the current question.

------------------------------------------------------------------------

### 3. Student Input Layer

Each marking request should include:

-   Assessment name
-   Question text
-   Student submission
-   Relevant criteria
-   Maximum marks
-   Academic level (e.g., NZQF Level 6)

------------------------------------------------------------------------

# Recommended Workflow

1.  Upload rubric and exemplar documents to a **vector store**
2.  Student submission is received
3.  Retrieve relevant rubric sections and exemplar answers
4.  Send retrieved context to OpenAI model
5.  Generate structured marking output
6.  Store results in grading system

------------------------------------------------------------------------

# Prompt Template

## Developer Prompt

    You are a careful academic marker.

    Your job is to assess a student answer against the supplied marking rubric and retrieved reference materials.

    Rules:

    1. Follow the rubric strictly.
    2. Base all judgements on the student's actual submission.
    3. Do not award marks for knowledge that is not demonstrated in the answer.
    4. Do not invent evidence.
    5. Use retrieved exemplars only as guidance, not as required wording.
    6. If rubric and exemplar conflict, prioritise the rubric.
    7. Provide clear reasoning for each criterion.
    8. Use British English.
    9. Return output only in the required JSON schema.
    10. If evidence is insufficient, explain why.

------------------------------------------------------------------------

# Example User Request

    Assessment: Cybersecurity Fundamentals Assignment

    Question:
    Explain the risks of phishing attacks in an office environment and propose mitigation strategies.

    Max marks: 20

    Student answer:
    [student answer text]

    Criteria:
    C1 Knowledge (0–8)
    C2 Application (0–6)
    C3 Recommendations (0–4)
    C4 Structure and clarity (0–2)

------------------------------------------------------------------------

# Recommended Retrieval Strategy

Retrieve:

-   Rubric rows for the matching criteria
-   Model answer for the same question
-   One strong exemplar answer
-   One weak exemplar answer
-   Moderation notes if available

Avoid retrieving large irrelevant documents.

------------------------------------------------------------------------

# File Organisation for Vector Store

Example file structure:

    rubrics/
        rubric_assignment1.md
        rubric_assignment2.md

    answers/
        model_answer_q1.md

    exemplars/
        exemplar_high_q1.md
        exemplar_mid_q1.md
        exemplar_low_q1.md

    moderation/
        moderation_notes_assignment2.md

------------------------------------------------------------------------

# Structured Output Schema

Example JSON response:

``` json
{
  "student_id": "string",
  "assessment": "string",
  "criteria": [
    {
      "criterion_id": "C1",
      "criterion_name": "Knowledge and understanding",
      "max_mark": 8,
      "awarded_mark": 6,
      "judgement": "The answer demonstrates a sound understanding of phishing risks.",
      "evidence": [
        "Mentions fake login pages",
        "Explains email spoofing"
      ],
      "improvement_advice": "Explain business email compromise more clearly."
    }
  ],
  "total_mark": 15,
  "overall_feedback": "A clear answer with good practical awareness."
}
```

------------------------------------------------------------------------

# Marking Logic

The model should follow this reasoning order:

1.  Identify relevant rubric criterion
2.  Extract evidence from student answer
3.  Compare evidence to rubric descriptors
4.  Assign mark
5.  Explain reasoning
6.  Produce final feedback

This approach reduces vague or inconsistent marking.

------------------------------------------------------------------------

# Cost and Performance Optimisation

Recommendations:

-   Keep rubric instructions stable to enable **prompt caching**
-   Retrieve only relevant rubric sections
-   Place dynamic content later in the prompt
-   Use structured outputs to simplify downstream processing

------------------------------------------------------------------------

# When to Use Prompt Only

Use prompt-only approach when:

-   Rubric is very short
-   Single question assessment
-   No exemplar answers required
-   Small marking batch

------------------------------------------------------------------------

# When to Use RAG

Use RAG when:

-   Rubrics are detailed
-   Multiple assessments exist
-   Exemplars are available
-   Moderation notes exist
-   Large course documentation is needed

------------------------------------------------------------------------

# Recommended Stack

Suggested tools:

-   OpenAI Responses API
-   Vector Store (OpenAI, Pinecone, Weaviate, Chroma)
-   Python backend
-   Structured JSON outputs
-   Prompt caching

------------------------------------------------------------------------

# Summary

Best practice for AI marking systems:

Developer Prompt → Controls behaviour\
Vector Store (RAG) → Supplies rubric & exemplars\
Student Input → Submission text

Model Output → Structured marking feedback

This architecture provides:

-   Consistent marking
-   Scalable grading
-   Reduced hallucinations
-   Easier moderation
