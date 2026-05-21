'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  FileText,
  FileOutput,
  Loader2,
  Check,
  ArrowRight,
  ClipboardPaste,
  Cpu,
  Video,
  Music4,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);
import Editor from '@/components/Editor';
import Toast, { ToastType } from '@/components/Toast';
import { exportToDocx, exportToTxt } from '@/utils/export';
import confetti from 'canvas-confetti';

type ProcessingStep = 'idle' | 'downloading' | 'extracting' | 'transcribing' | 'completed' | 'error';

export default function Home() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ProcessingStep>('idle');
  const [editorContent, setEditorContent] = useState('');
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [copied, setCopied] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [rapidApiKey, setRapidApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showRapidKey, setShowRapidKey] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('transcribe_openai_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
    const savedRapidKey = localStorage.getItem('transcribe_rapidapi_key');
    if (savedRapidKey) {
      setRapidApiKey(savedRapidKey);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('transcribe_openai_api_key', key);
  };

  const handleSaveRapidApiKey = (key: string) => {
    setRapidApiKey(key);
    localStorage.setItem('transcribe_rapidapi_key', key);
  };

  // Helper to add toast
  const addToast = (message: string, type: ToastType['type']) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  // Helper to remove toast
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Safe clipboard paste helper
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        addToast('URL pasted from clipboard', 'info');
      } else {
        addToast('Clipboard is empty', 'info');
      }
    } catch {
      addToast('Please paste the URL manually using Ctrl+V', 'info');
    }
  };

  // Core transcription submission handler
  const handleTranscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      addToast('Please enter an Instagram Reel URL', 'error');
      return;
    }

    const reelPattern = /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]+\/?(\?.*)?$/;
    if (!reelPattern.test(url.trim())) {
      addToast('Invalid Instagram Reel URL format. Must be like: https://www.instagram.com/reel/...', 'error');
      return;
    }

    // Initialize process state
    setStatus('downloading');
    setEditorContent('');
    addToast('Starting transcription request...', 'info');

    // Simulate progress updates for a smoother UI experience
    // Since API runs synchronously, we stagger stages based on expected duration
    const progressTimer = setTimeout(() => {
      setStatus('extracting');
    }, 4500);

    const transcribeTimer = setTimeout(() => {
      setStatus('transcribing');
    }, 9000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey.trim()) {
        headers['x-openai-api-key'] = apiKey.trim();
      }
      if (rapidApiKey.trim()) {
        headers['x-rapidapi-key'] = rapidApiKey.trim();
      }

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: url.trim() }),
      });

      // Clear the fake state timers
      clearTimeout(progressTimer);
      clearTimeout(transcribeTimer);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred during transcription.');
      }

      // Convert transcript lines into formatted HTML for Tiptap
      const formattedTranscript = data.transcript
        .split('\n')
        .map((paragraph: string) => `<p>${paragraph}</p>`)
        .join('');

      setEditorContent(formattedTranscript || '<p>No speech detected in this Reel.</p>');
      setStatus('completed');
      addToast('Transcription successfully completed!', 'success');

      // Celebrate with confetti
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#c084fc', '#e879f9', '#ffffff'],
      });

    } catch (err) {
      clearTimeout(progressTimer);
      clearTimeout(transcribeTimer);
      setStatus('error');
      const errMsg = err instanceof Error ? err.message : 'Failed to generate transcript.';
      addToast(errMsg, 'error');
    }
  };

  const handleCopy = async () => {
    if (!editorContent) return;

    // Extract plain text from HTML content
    const tempElement = document.createElement('div');
    tempElement.innerHTML = editorContent;
    const plainText = tempElement.innerText || tempElement.textContent || '';

    try {
      await navigator.clipboard.writeText(plainText.trim());
      setCopied(true);
      addToast('Transcript copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Failed to copy text. Please select and copy manually.', 'error');
    }
  };

  const handleDownloadTxt = () => {
    if (!editorContent) return;
    exportToTxt(editorContent, 'instagram-reel-transcript.txt');
    addToast('Downloaded TXT file', 'success');
  };

  const handleDownloadDocx = async () => {
    if (!editorContent) return;
    try {
      await exportToDocx(editorContent, 'instagram-reel-transcript.docx');
      addToast('Downloaded Word document (DOCX)', 'success');
    } catch {
      addToast('Failed to generate DOCX document', 'error');
    }
  };

  const isLoading = status === 'downloading' || status === 'extracting' || status === 'transcribing';

  return (
    <main className="relative min-h-screen flex flex-col items-center px-4 py-12 md:py-20 select-none overflow-hidden">
      {/* Settings Button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition-all duration-200 shadow-lg active:scale-95"
          title="OpenAI API Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Decorative Background Accents */}
      <div className="absolute top-[-10%] left-[-20%] w-[600px] h-[600px] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[600px] h-[600px] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-4xl flex flex-col gap-10 z-10">

        {/* Header Block */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            AI Reel Transcription Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl leading-tight">
            Transcribe Instagram Reels Instantly
          </h1>
          <p className="text-zinc-400 text-sm md:text-base max-w-lg leading-relaxed">
            Convert any public Instagram Reel into editable, formatted text document.
            Download transcripts instantly in TXT or Word formats.
          </p>
        </div>

        {/* Input Card */}
        <div className="w-full bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 md:p-6 shadow-2xl transition-all duration-300">
          <form onSubmit={handleTranscribe} className="flex flex-col gap-4">
            <div className="relative flex items-center">
              <div className="absolute left-4 text-zinc-500">
                <InstagramIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                placeholder="Paste Instagram Reel URL here..."
                className="w-full pl-12 pr-28 py-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 text-sm transition-all duration-200 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={isLoading}
                className="absolute right-3 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-150 disabled:opacity-40"
                title="Paste from clipboard"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Transcript...
                </>
              ) : (
                <>
                  Generate Transcript
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Loading / Stage Display */}
        {isLoading && (
          <div className="w-full bg-zinc-950/50 border border-zinc-900 rounded-2xl p-6 shadow-xl flex flex-col gap-6 animate-pulse">
            <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
              <span className="text-zinc-400 text-sm font-semibold flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                Processing request...
              </span>
              <span className="text-xs text-zinc-500">Takes about 15-30 seconds</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${status === 'downloading'
                  ? 'border-purple-500/30 bg-purple-500/5 text-purple-300'
                  : 'border-zinc-800/40 bg-zinc-900/10 text-zinc-500'
                } transition-all duration-300`}>
                <Video className={`w-5 h-5 ${status === 'downloading' ? 'text-purple-400' : ''}`} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">1. Downloading Reel</span>
                  <span className="text-[10px] opacity-80">Fetching via yt-dlp</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${status === 'extracting'
                  ? 'border-purple-500/30 bg-purple-500/5 text-purple-300'
                  : 'border-zinc-800/40 bg-zinc-900/10 text-zinc-500'
                } transition-all duration-300`}>
                <Music4 className={`w-5 h-5 ${status === 'extracting' ? 'text-purple-400' : ''}`} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">2. Extracting Audio</span>
                  <span className="text-[10px] opacity-80">Converting to MP3 via ffmpeg</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${status === 'transcribing'
                  ? 'border-purple-500/30 bg-purple-500/5 text-purple-300'
                  : 'border-zinc-800/40 bg-zinc-900/10 text-zinc-500'
                } transition-all duration-300`}>
                <Cpu className={`w-5 h-5 ${status === 'transcribing' ? 'text-purple-400' : ''}`} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">3. Whisper API</span>
                  <span className="text-[10px] opacity-80">Generating text transcript</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Editor & Action Bar Container */}
        {(editorContent || status === 'completed') && (
          <div className="flex flex-col gap-4 animate-slide-in">
            {/* Action Bar (Top) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/30 border border-zinc-800/60 p-3 rounded-xl">
              <span className="text-xs font-semibold text-zinc-400 pl-1">
                Document Editor
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopy}
                  type="button"
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium border border-zinc-800 transition-all duration-150"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Text
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadTxt}
                  type="button"
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium border border-zinc-800 transition-all duration-150"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Download TXT
                </button>

                <button
                  onClick={handleDownloadDocx}
                  type="button"
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-purple-100 text-xs font-medium border border-purple-500/20 transition-all duration-150"
                >
                  <FileOutput className="w-3.5 h-3.5" />
                  Download DOCX
                </button>
              </div>
            </div>

            {/* Document Editor Component */}
            <Editor content={editorContent} onChange={setEditorContent} />
          </div>
        )}

      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-slide-in">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-400" />
                API Configuration
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold text-zinc-400">OpenAI API Key (Optional)</label>
              <div className="relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full pl-3 pr-10 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-800 focus:outline-none focus:border-purple-500 text-xs transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                If left blank, the server will fallback to the key defined in the server environment variables.
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="text-[11px] font-semibold text-zinc-400">RapidAPI Key (Optional, for Instagram Scraper)</label>
              <div className="relative flex items-center">
                <input
                  type={showRapidKey ? 'text' : 'password'}
                  value={rapidApiKey}
                  onChange={(e) => handleSaveRapidApiKey(e.target.value)}
                  placeholder="Paste your RapidAPI Key here..."
                  className="w-full pl-3 pr-10 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-800 focus:outline-none focus:border-purple-500 text-xs transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowRapidKey(!showRapidKey)}
                  className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showRapidKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Use if the default downloader fails due to Instagram blocks. Supports &quot;Instagram Downloader&quot; (social-api1) on RapidAPI.
              </p>
            </div>

            <button
              onClick={() => {
                setShowSettings(false);
                addToast('Settings updated', 'success');
              }}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg transition-colors mt-1"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <Toast toasts={toasts} onClose={removeToast} />
    </main>
  );
}
