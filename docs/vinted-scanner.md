# AI-Powered Market Search (Vinted Scanner)

## 1. Overview
Leverages the Gemini 3 Flash model with Google Search grounding to find physical copies of books on Vinted.pl.

## 2. Search Logic
- **Input**: Book title and author from the Notion database.
- **AI Model**: `gemini-3-flash-preview`.
- **Grounding**: Uses `google_search_retrieval` to perform real-time web searches.
- **Prompting**:
  - Instructs the AI to find active listings on `vinted.pl` for the specific book.
  - Requires the AI to return direct links to the listings.

## 3. Frontend Integration
- **Trigger**: User clicks the "Vinted" icon next to a book in the library check or search results.
- **Display**: Shows the AI-generated response (links and descriptions) in a modal or dedicated section.
- **Status**: Displays a "Searching..." state while the AI processes the request.

## 4. Implementation Details
- **API**: Uses the `@google/genai` SDK.
- **Security**: Requires a valid `GEMINI_API_KEY` in the environment.
- **Reliability**: Relies on the AI's ability to parse search results and identify relevant listings.
