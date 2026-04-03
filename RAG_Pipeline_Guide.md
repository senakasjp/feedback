# Two-Stage RAG Pipeline for Large-Scale Literature Review (200 PDFs)

## Overview

This guide describes how to build a **token-efficient, scalable Retrieval-Augmented Generation (RAG) system** for academic research using ~200 PDFs.

The system follows a **two-stage architecture**:
1. **Raw document ingestion + indexing**
2. **Structured summary generation + secondary retrieval**

This approach significantly reduces token usage and improves synthesis quality.

---

## Architecture

PDFs → Parsing → Chunking → Embeddings → Vector DB (raw)
        ↓
    LLM summarization → Structured JSON → Vector DB (summaries)
        ↓
    Query → Retrieve summaries → (optional raw lookup) → LLM → Answer

---

## Tech Stack

- Language: Python
- Framework: LlamaIndex (preferred) or LangChain
- LLM: OpenAI (GPT-4o / GPT-4.1)
- Embeddings: text-embedding-3-small
- Vector DB: Chroma (local) or FAISS
- PDF Parsing: PyMuPDF (fitz) or pdfplumber

---

## Project Structure

rag-pipeline/
│
├── data/
│   ├── raw_pdfs/
│   └── summaries/
│
├── db/
│   ├── raw_index/
│   └── summary_index/
│
├── scripts/
│   ├── ingest.py
│   ├── summarize.py
│   ├── build_index.py
│   └── query.py
│
├── utils/
│   ├── parser.py
│   ├── prompts.py
│   └── embeddings.py
│
├── .env
└── README.md

---

## Environment Setup

pip install llama-index openai chromadb pymupdf python-dotenv

Create `.env`:

OPENAI_API_KEY=your_key_here

---

## Step 1: PDF Ingestion

### Objective
Extract and clean text from PDFs, then split into chunks.

### Instructions

- Load PDFs from `/data/raw_pdfs`
- Extract text using PyMuPDF
- Clean text:
  - Remove headers/footers
  - Fix broken line breaks
- Chunk text:
  - 500–800 tokens per chunk
  - 50–100 token overlap

### Output

- List of chunks per document
- Metadata:
  - filename
  - title (if extractable)

---

## Step 2: Structured Summarization

### Objective
Convert each paper into structured JSON for efficient retrieval.

### Prompt Template

You are an expert research assistant.

Given the following academic paper content, extract structured information.

Return ONLY valid JSON.

Fields:
- title
- research_problem
- methodology
- dataset
- key_findings
- limitations
- keywords (list)
- domain

Paper:
{paper_text}

### Strategy

- If paper is long:
  1. Summarize chunks individually
  2. Merge into final summary

### Output Example

{
  "title": "Transformer Models for NLP",
  "research_problem": "Improving sequence modeling...",
  "methodology": "Attention-based transformer architecture...",
  "dataset": "WMT 2014 English-German",
  "key_findings": "Outperforms RNNs...",
  "limitations": "High compute cost...",
  "keywords": ["transformer", "NLP", "attention"],
  "domain": "Natural Language Processing"
}

### Save Location

/data/summaries/{paper_id}.json

---

## Step 3: Build Vector Indexes

### Raw Index

- Store all text chunks
- Used for deep retrieval when needed

### Summary Index (Critical)

- Store structured summaries
- Embed key fields:

Title: ...
Method: ...
Findings: ...
Keywords: ...

---

## Step 4: Query Pipeline

### Workflow

1. Retrieve top K summaries (5–10)
2. Optionally retrieve raw chunks from selected papers
3. Generate final answer

---

### Query Prompt

You are an expert academic researcher.

Using the following paper summaries, answer the question.

- Compare findings across papers
- Highlight similarities and differences
- Cite paper titles in your answer

Question:
{query}

Summaries:
{retrieved_summaries}

---

## Step 5: Literature Review Generation

### Prompt Template

Write a literature review section based on the following summaries.

Requirements:
- Group papers by themes
- Compare methodologies
- Highlight research gaps
- Use formal academic tone
- Cite paper titles inline

Summaries:
{retrieved_summaries}

---

## Token Optimization Strategy

### Do

- Use summaries for most queries
- Limit retrieval to top 5–8 results
- Keep summaries under 500 tokens

### Avoid

- Sending full PDFs repeatedly
- Large unfiltered context windows

---

## Advanced Enhancements

### 1. Thematic Clustering

- Cluster summaries by:
  - domain
  - methodology
- Store cluster labels

---

### 2. Multi-Hop Retrieval

- First retrieve summaries
- Then refine and re-query

---

### 3. Citation Tracking

Store:
- title
- filename
- page numbers (optional)

---

## Example Queries

- What are common methods for X?
- Compare supervised vs unsupervised approaches
- What are the main limitations across studies?
- Which papers use dataset Y?

---

## Expected Outcomes

- Handles 200+ PDFs efficiently
- Reduces token usage by 2–5×
- Produces high-quality academic writing
- Minimizes hallucinations

---

## Final Implementation Guidelines

- Write modular Python code
- Separate ingestion, summarization, and querying
- Use async processing for scalability
- Log progress for long-running tasks
- Validate JSON outputs strictly
- Optimize for both cost and performance

---

## Optional Extensions

- Add UI (Streamlit / Litewrite integration)
- Export citations in BibTeX format
- Add evaluation metrics for summary quality

---

## Summary

This two-stage RAG system transforms large-scale academic reading into a **structured, queryable knowledge base**, enabling efficient and high-quality literature review generation.
