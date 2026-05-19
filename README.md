# Instagram Reel Transcription Web App

A modern, minimal, and premium single-page web application to download Instagram Reels, extract high-fidelity audio, transcribe it via AI, and load it into a rich-text document editor.

## Key Features
*   **Instagram Reel Link Ingestion**: Validates and downloads reels using `yt-dlp`.
*   **High-Quality Audio Extraction**: Extracts and formats audio using `ffmpeg`.
*   **OpenAI Whisper Integration**: Processes audio using AI transcription to deliver fast, highly accurate text.
*   **Tiptap Document Editor**: Displays transcript inside an editable rich-text interface with standard styling controls (bold, italic, headings, lists, blockquotes).
*   **Easy Exporting**: Copy transcript to clipboard, download as plain text (.txt), or download as formatted Microsoft Word document (.docx).
*   **Client-Side API Key Support (Open to Everyone)**: Users can click the settings gear in the top right to save their own OpenAI API Key in their browser's local storage. This allows you to host the app publicly without incurring transcription costs for other users.
*   **Premium Interface**: Custom dark mode layout, micro-animations, loading steps, and success celebration effects.

---

## Pre-requisites

Make sure the following dependencies are installed and available in your system's `PATH`:

1.  **Node.js**: Version 18.0.0 or higher.
2.  **yt-dlp**: Required for downloading video streams.
    *   *Windows*: `winget install yt-dlp` or download from the official GitHub release.
    *   *macOS*: `brew install yt-dlp`
3.  **FFmpeg**: Required for audio conversion.
    *   *Windows*: `winget install Gyan.FFmpeg` or download from official sources.
    *   *macOS*: `brew install ffmpeg`

---

## Getting Started

### 1. Configure Environment Variables
Create a file named `.env.local` in the project root (a template `.env.local` is provided) and add your default OpenAI API Key:

```env
OPENAI_API_KEY=your-openai-api-key
```

*Note: If no server-side key is specified, users must provide their own key in the application's UI settings modal.*

### 2. Install Project Dependencies
Install the required packages using npm:

```bash
npm install --legacy-peer-deps
```

### 3. Run the Development Server
Launch the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## Production Deployment

### Traditional Run (Node.js)
To compile and optimize the application for production use:

```bash
npm run build
npm run start
```

### Containerized Deployment (Docker)
We have included a production-ready `Dockerfile` to simplify deployment to platforms like Render, Railway, Fly.io, or VPS setups. The Docker image automatically bundles the latest versions of `yt-dlp` and `ffmpeg`.

To build and run locally with Docker:

```bash
# Build the Docker image
docker build -t instagram-transcriber .

# Run the container
docker run -p 3000:3000 --env OPENAI_API_KEY=your-key instagram-transcriber
```

---

## Troubleshooting: exFAT Drive Errors
If you are developing or running this application on an external SSD/USB drive formatted as **exFAT**, standard Next.js commands will fail with a `readlink` `EISDIR` error due to filesystem limitations.

To resolve this, we have included a custom filesystem patch script in the workspace root:

*   **To run in Development**:
    ```bash
    node -r ./patch-fs.js node_modules/next/dist/bin/next dev
    ```
*   **To Build for Production**:
    ```bash
    node -r ./patch-fs.js node_modules/next/dist/bin/next build
    ```
*   **To run in Production**:
    ```bash
    node -r ./patch-fs.js node_modules/next/dist/bin/next start
    ```
