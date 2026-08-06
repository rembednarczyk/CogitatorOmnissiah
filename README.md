# Adeptus Archivist: Sci-Fi Award Synchronizer

Adeptus Archivist is a specialized tool designed to bridge the gap between sci-fi literature encyclopedias and personal Notion databases. It automates the process of tracking award-winning science fiction novels, ensuring your personal library or reading list is always up-to-date with the latest data from the "Archiwum Encyklopedii Fantastyki".

## Project Goals

- **Automated Data Harvesting**: Extract structured data from MediaWiki-based encyclopedias (specifically Hugo, Nebula, and Locus awards).
- **Notion Integration**: Seamlessly synchronize harvested data with a Notion database, handling both new entries and updates to existing ones.
- **Data Enrichment**: Automatically fetch additional details like publishers and series information for each book.
- **Market Intelligence**: Integrated Vinted scanner to help users find physical copies of award-winning books.

## Architectural Solutions

### 1. Hybrid Full-Stack Architecture
The application uses a **Vite + Express** hybrid setup. 
- **Frontend**: A high-performance React SPA styled with Tailwind CSS, featuring a "Cyber-Archivist" aesthetic. It uses Framer Motion for immersive animations and Lucide-React for iconography.
- **Backend**: An Express.js server that handles long-running synchronization tasks, API proxying, and secure communication with external services (Notion, MediaWiki).

### 2. Service-Oriented Architecture (Refactored)
To adhere to the **Single Responsibility Principle (SRP)**, the backend has been refactored into a modular structure:
- **Services (`/services/`)**: Encapsulate core business logic for different synchronization tasks (e.g., `BookSyncService`, `DuplicateSyncService`, `PublisherSyncService`, `SeriesSyncService`, `CyclesSyncService`, `LpSyncService`, `StatsService`, `IntegrityService`, `PurificationService`, `SchemaValidationService`).
- **Controllers (`/controllers/`)**: Handle HTTP request parsing and response formatting, delegating business logic to services.
- **Routes (`/routes/`)**: Define API endpoints and map them to appropriate controllers.
- **SyncManager**: Acts as an orchestrator that coordinates the execution of various synchronization services.

### 3. Adapter Pattern for External Services
To maintain clean separation of concerns, the project implements dedicated adapters:
- **NotionAdapter**: Encapsulates the complexity of the Notion SDK, managing database queries, page creation, and property mapping.
- **WikiAdapter**: Handles HTTP communication with the MediaWiki API, including content fetching and slot-based data retrieval.

### 4. Real-Time Progress Tracking (SSE)
Synchronization tasks can be time-consuming. The system uses **Server-Sent Events (SSE)** to provide real-time feedback to the frontend. This allows the user to see exactly which book is being processed, the current progress percentage, and estimated time of arrival (ETA).

### 5. Intelligent Data Merging & Normalization
The sync engine doesn't just overwrite data. It:
- **Data Normalization**: A dedicated `DataNormalizer` service handles specific exceptions for publishers (e.g., "Zysk i S-ka") and original titles to ensure consistency across different data sources.
- **Diff Engine**: A specialized `DiffEngine` ensures that multi-select properties in Notion are compared correctly (ignoring order and whitespace) before triggering an update.
- **Multi-Award Handling**: Correctly merges multiple awards for a single book (e.g., a book winning both Hugo and Nebula).
- **Smart Updates**: Compares existing Notion data with Wiki data and only performs updates if changes are detected, minimizing API calls.

### 6. AI-Powered Market Search
The "Vinted Artifact Scanner" leverages the **Gemini 3 Flash** model with Google Search grounding. This allows the app to perform real-time web searches for current listings on Vinted.pl, providing users with direct links to purchase books.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Motion, Lucide-React.
- **Backend**: Node.js, Express, Axios.
- **Integrations**: Notion SDK, MediaWiki API, Google GenAI (Gemini).
- **Dev Tools**: Vitest, TypeScript, Vite, tsx, esbuild.

## Environment Configuration

The application requires the following environment variables:
- `NOTION_API_KEY`: Your Notion integration token.
- `NOTION_DATABASE_ID`: The ID of the target Notion database.
- `GEMINI_API_KEY`: API key for AI-powered features.

---
*Developed for the preservation of literary artifacts in the digital age.*

## Test Suite

The project includes a comprehensive test suite covering frontend, backend, and core logic, organized into a clean directory structure.

### 1. Test Directory Structure
- **`/__tests__/`**: Infrastructure, adapters, and server tests.
- **`/services/__tests__/`**: Business logic and synchronization services.
- **`/src/__tests__/`**: Main UI components (e.g., `App.test.tsx`).
- **`/src/hooks/__tests__/`**: Custom React hooks.

### 2. Frontend Integration Tests (`src/__tests__/App.test.tsx`)
- **Status Ducha Maszyny**: Verifies the rendering of the "Machine Spirit" status and award links.
- **Award Selection**: Ensures all award options (Hugo, Nebula, Locus, All) are available in the dropdown.
- **Synchronization Flow**:
    - Tests single award synchronization (Hugo, Nebula, Locus).
    - Tests "All Awards" synchronization flow.
    - Verifies real-time UI updates during streaming (status messages, progress bar).
    - **Sync Summary**: Asserts on the final summary, checking counts for added, updated, and skipped items, and verifying the list of added book names.
- **Tool Navigation**: Checks the visibility of data exploration, cycle marking, and Rytuał Rekonstrukcji Liczb tools.
- **Schema Editor**:
    - Verifies rendering of Notion properties and their status (usage percentage).
    - Tests the ability to delete options from properties (except for the "Autor" property).
- **Vinted Scanner**: Verifies the UI state during a Vinted artifact search.

### 3. Backend API Tests (`__tests__/server.test.ts`)
- **Health & Config**: Verifies `/api/health` and `/api/config` endpoints.
- **Notion Schema**: Tests fetching and updating the Notion database schema via `/api/notion/schema`.
- **Sync Control**:
    - Verifies the initiation of the synchronization stream via `/api/sync`.
    - Tests the synchronization stop mechanism via `/api/sync/stop`.

### 4. Core Logic & Service Tests
- **Data Extraction (`__tests__/wiki.parser.test.ts`)**: Tests the `WikiParser` logic for extracting publisher and series information from complex MediaWiki wikitext templates.
- **Service Logic (`services/__tests__/*.test.ts`)**: Comprehensive tests for each synchronization service, ensuring correct data comparison, normalization, and Notion updates.
- **Hook Logic (`src/hooks/__tests__/*.test.ts`)**: Verifies the behavior of custom React hooks, including SSE handling in `useSync`.

### Running Tests
To execute the full test suite, run:
```bash
npm test
```

## Synchronization Process

The synchronization process is a multi-stage pipeline designed to ensure data integrity and minimize Notion API usage.

### 1. Data Harvesting
- **Wiki Fetching**: The `WikiAdapter` fetches raw wikitext from the "Archiwum Encyklopedii Fantastyki" for the selected award page.
- **Parsing**: The `WikiParser` processes the wikitext, stripping HTML/Wiki markup, normalizing table structures, and extracting book metadata (year, author, titles). It uses a priority system to pick the most relevant edition details from `{{tabela wydania}}`.

### 2. Data Merging & Normalization
- **Data Normalization**: The `DataNormalizer` service applies specific rules to publishers and titles to handle known variations and ensure data consistency.
- **Deduplication**: Books appearing multiple times (e.g., winning multiple awards) are merged into a single entry with a combined list of awards.
- **Duplicate Detection**: The system uses a strict word-matching algorithm on original titles. If two books share at least two significant words (ignoring common stop words and short words) in their original titles, they are flagged as potential duplicates.
- **Award Logic**: If a book wins Hugo, Nebula, and Locus, it is automatically tagged with the "Wszystkie" (All) award.

### 3. Notion Synchronization
- **Database Query**: The system queries the existing Notion database to build a map of books already present, using Polish or original titles as keys.
- **Comparison & Action**:
    - **New Book**: If not found, a new row is created in Notion with all properties.
    - **Existing Book**: If found, the system compares existing Notion data with the new data.
    - **Update**: If differences are detected (e.g., new award, title change), only the specific fields are updated in Notion.
    - **Skip**: If no changes are detected, the book is skipped to save API quota.

### 4. Real-Time Reporting
- The backend streams progress updates to the frontend using **Server-Sent Events (SSE)**, reporting:
    - `status`: Current stage of the pipeline.
    - `progress`: Percentage completion for long-running tasks.
    - `complete`: Final summary containing counts of added, updated, and skipped books, along with lists of added/updated titles.
