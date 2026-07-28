---
title: "Agentic AI: Using a Buzzword to Justify Premium Charges to Uninformed Buyers"
date: 2025-06-06T13:00:00.005+04:00
lastmod: 2025-06-06T13:03:42.495+04:00
slug: "agentic-ai-using-buzzword-to-justify"
tags:
  - "Agentic AI"
  - "Agents"
  - "AI"
  - "machine learning"
system: "Agentic AI"
sourceURL: "https://www.subhashdasyam.com/2025/06/agentic-ai-using-buzzword-to-justify.html"
---
Since my original post took off, quite a few of you have reached out asking for more detailed examples. So today, I’m diving into one of those examples from the previous post and unpacking it in greater depth.

## The Marketing Claim

"Our autonomous AI agent researches competitors, analyzes their strategies, and creates comprehensive reports with no human intervention."

## The Reality: A Step-by-Step Breakdown

### Step 1: User Interface (What the User Sees)

Frontend GUI:

Sees a progress bar with AI-sounding status updates:

- "AI Agent initializing research protocols..."
- "Autonomous discovery of competitive landscape..."
- "Deep learning analysis in progress..."
- "Generating strategic insights..."

User's Perception: A magical AI is thinking and researching autonomously.

---

### Step 2: Backend Reality (What Actually Happens)

#### Phase 1: Query Understanding (First LLM Call)

```
INPUT: "Research Tesla's competitors in the EV market and analyze their strategies"

LLM CALL #1 - Query Parser:
PROMPT: "You are a business research task planner. Break down this user request into structured objectives and identify key entities. Return your response in JSON format with: primary_company, industry, competitors_to_research, analysis_types, and data_requirements."

LLM RESPONSE:
{
  "primary_company": "Tesla",
  "industry": "Electric Vehicle Market",
  "competitors_to_research": ["Rivian", "Lucid Motors", "Ford Lightning", "GM Ultium", "BYD", "Nio"],
  "analysis_types": ["financial_performance", "product_comparison", "market_positioning", "strategic_initiatives"],
  "data_requirements": ["revenue_data", "product_specs", "pricing", "market_share", "recent_news"]
}

```

System Processing:

```
1. Parse LLM JSON response
2. Validate competitor list against internal database
3. Cross-reference with available data sources
4. Generate data collection workflow based on requirements
5. Create execution plan with API endpoints and scraping targets

```

This looks like AI planning, but it's really: A sophisticated prompt that converts natural language into structured data, which then feeds into traditional programming workflows.

#### Phase 2: Data Collection (API Orchestration)

The system runs a predetermined workflow - not AI decision-making:

2.1 Company Information Gathering

```
FOR each competitor:
  - Call Clearbit API → company info, funding, employee count
  - Call LinkedIn API → executive team data
  - Call SEC API → financial filings
  - Call Patent API → recent patent applications
  - Web scraping → press releases, product pages

```

2.2 Financial Data Collection

```
FOR each competitor:
  - Yahoo Finance API → stock performance
  - Crunchbase API → funding rounds
  - Parse 10-K filings → revenue, R&D spending

```

2.3 Product Intelligence

```
FOR each competitor:
  - Scrape product specification pages
  - Parse pricing information
  - Collect customer review data (Google, Trustpilot APIs)
  - Monitor social media mentions (Twitter API)

```

Still no AI - just API calls, web scraping, and data parsing with traditional programming.

#### Phase 3: Data Processing (Standard Analytics)

3.1 Data Normalization

```
- Clean and standardize collected data
- Remove duplicates and inconsistencies
- Convert different data formats to common schema
- Handle missing values with predefined rules

```

3.2 Metrics Calculation

```
- Calculate market share percentages
- Compute growth rates from historical data
- Generate pricing comparison matrices
- Score competitive positioning using weighted algorithms

```

3.3 Pattern Recognition

```
- Run clustering algorithms on product features
- Perform sentiment analysis on customer reviews
- Calculate correlation coefficients between metrics
- Apply predefined business rules for strategic categorization

```

This is traditional data science - pandas, numpy, scikit-learn, not "AI agents."

---

### Step 3: The LLM Finally Appears (Limited Role)

After all the data collection and processing, the system makes strategic LLM calls:

#### Call #2: Executive Summary Generation

```
PROMPT: "You are a business analyst. Based on this structured data about Tesla's competitors [INSERT PROCESSED DATA], write a 200-word executive summary focusing on key competitive threats."

INPUT: Clean, structured data tables
OUTPUT: Polished executive summary text

```

#### Call #3: Strategic Insights

```
PROMPT: "Analyze these competitive metrics and identify 3 key strategic patterns. Format as bullet points."

INPUT: Calculated metrics and trends
OUTPUT: Strategic bullet points

```

#### Call #4: Report Formatting

```
PROMPT: "Format this analysis into a professional business report structure with appropriate headings."

INPUT: All collected insights
OUTPUT: Well-formatted report sections

```

Total LLM Usage: ~4 strategic API calls - query parsing and text generation, not "autonomous AI research."

---

### Step 4: Report Assembly (Template Engine)

4.1 Template Population

```
- Load predefined report template (docx/html)
- Insert generated text into appropriate sections
- Populate data tables with processed metrics
- Generate charts using matplotlib/D3.js
- Add company logos and styling

```

4.2 Quality Assurance

```
- Run spell-check and grammar validation
- Verify all data sources are cited
- Ensure charts render correctly
- Check report length meets requirements

```

---

### Step 5: User Delivery (What the User Sees Again)

Final Interface:

- Progress bar completes: "AI Analysis Complete!"
- User downloads a polished 15-page PDF report
- Report includes charts, tables, executive summary, and strategic recommendations
- Delivery time: 3-5 minutes

User's Experience: "Wow, the AI generated this entire report autonomously!"

---

## The Technical Architecture Reality

### What Powers This "Agentic AI"

Core Components:

1. Workflow Engine (Apache Airflow/custom) - orchestrates the process
2. API Gateway - manages external service calls
3. Data Pipeline (ETL) - processes and cleans collected information
4. Template Engine - formats final output
5. 3-4 Strategic LLM Calls - for text generation only

Programming Languages & Tools:

- Python/Node.js - main backend logic
- SQL/NoSQL databases - data storage
- REST APIs - external integrations
- Pandas/NumPy - data processing
- Scrapy/Beautiful Soup - web scraping
- Jinja2/Handlebars - report templating
- OpenAI/Claude API - text generation (minimal usage)

### The Execution Flow Truth

```text
User Input → LLM Query Parser → Database Lookup → API Orchestrator 
    ↓
Data Collection (15+ APIs) → Data Processing Pipeline → Analytics Engine
    ↓
Strategic LLM Calls (3x) → Template Engine → PDF Generator → User

```

Time Breakdown:

- Data Collection: 55% of processing time
- Data Analysis: 25% of processing time
- LLM Calls (Query + Text Generation): 15% of processing time
- Report Formatting: 5% of processing time

---

## Marketing vs. Reality

| Marketing Claim | Technical Reality |
| --- | --- |
| "Autonomous AI Agent" | Predetermined workflow with conditional logic |
| "Deep Learning Analysis" | Standard statistical calculations and data processing |
| "AI-Powered Research" | API calls to existing databases and web scraping |
| "Intelligent Strategic Insights" | Rule-based analysis + template-generated text |
| "Revolutionary AI Technology" | Traditional software engineering + 3 LLM calls |

---

## The Bottom Line

This "agentic AI" system is actually:

75% Traditional Software Engineering:

- Database queries and API integrations
- Data processing and statistical analysis
- Web scraping and information parsing
- Template engines and report generation

15% Business Logic:

- Workflow orchestration
- Data validation rules
- Competitive analysis frameworks
- Quality assurance processes

10% Large Language Model Usage:

- Query understanding and task decomposition
- Text summarization and strategic insights
- Professional writing tone and report formatting

### What You're Really Paying For

When companies charge premium prices for this "AI agent," you're paying for:

1. API Subscriptions - Access to data sources (70% of operational cost)
2. Software Development - The integration and processing pipeline
3. Business Intelligence - The analytical frameworks and metrics
4. User Experience - The polished interface and report templates
5. LLM API Calls - A small fraction for text generation

The "AI" is essentially a sophisticated data aggregation and formatting system with some natural language generation at the end.
