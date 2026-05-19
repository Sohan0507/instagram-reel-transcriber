import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import OpenAI from 'openai';

// Initialize OpenAI client
// We initialize inside the handler or globally, but globally is standard.
// We'll read from process.env.OPENAI_API_KEY.
const getOpenAIClient = (clientKey?: string | null) => {
  const apiKey = clientKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API Key is missing. Please configure it in Settings (top-right) or on the server.');
  }
  return new OpenAI({ apiKey });
};

// Regex to validate Instagram URL
const REEL_REGEX = /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]+\/?(\?.*)?$/;

// Promisified child_process spawn helper
function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // On Windows, commands might need shell: true or we call the executable directly.
    // Since yt-dlp and ffmpeg are in PATH, spawn('cmd.exe', ['/c', command, ...args]) or spawn(command, args) works.
    // Let's use shell: true on Windows for maximum compatibility with path resolution, or spawn.
    const isWindows = os.platform() === 'win32';
    
    // Using shell option for spawn on Windows solves issues with executing path-resolved binaries.
    const process = spawn(command, args, { shell: isWindows });
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command '${command}' exited with code ${code}. Stderr: ${stderr.trim()}`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to start command '${command}': ${err.message}`));
    });
  });
}

export async function POST(request: NextRequest) {
  let videoPath = '';
  let audioPath = '';
  
  try {
    const body = await request.json();
    const { url } = body;
    const clientKey = request.headers.get('x-openai-api-key');

    // 1. Validate Input
    if (!url) {
      return NextResponse.json(
        { error: 'Instagram Reel URL is required.' },
        { status: 400 }
      );
    }

    if (!REEL_REGEX.test(url.trim())) {
      return NextResponse.json(
        { error: 'Invalid Instagram Reel URL format. Must be a valid reel, reels, or post URL.' },
        { status: 400 }
      );
    }

    // 2. Validate API Key
    let openai: OpenAI;
    try {
      openai = getOpenAIClient(clientKey);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'OpenAI API Key is missing.';
      return NextResponse.json(
        { error: msg },
        { status: 400 }
      );
    }

    // 3. Setup Temp Paths
    const id = Math.random().toString(36).substring(2, 10);
    const tempDir = os.tmpdir();
    videoPath = path.join(tempDir, `reel_${id}.mp4`);
    audioPath = path.join(tempDir, `audio_${id}.mp3`);

    console.log(`[API] Processing reel download. ID: ${id}`);
    console.log(`[API] Temp video path: ${videoPath}`);
    console.log(`[API] Temp audio path: ${audioPath}`);

    // 4. Download Reel via yt-dlp
    // We request best format (video + audio) but restrict to generic mp4 wrapper if possible.
    // If the download fails, it might be due to cookies, private account, etc.
    try {
      await runCommand('yt-dlp', [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--no-playlist',
        '-o', videoPath,
        url.trim()
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown download error';
      console.error('[API] yt-dlp download failed:', msg);
      return NextResponse.json(
        { error: 'Failed to download the Reel. The video might be private, deleted, or blocked by Instagram.' },
        { status: 500 }
      );
    }

    // Double check if file actually exists
    if (!fs.existsSync(videoPath)) {
      return NextResponse.json(
        { error: 'Downloaded Reel file was not found on disk.' },
        { status: 500 }
      );
    }

    console.log('[API] Download successful. Extracting audio...');

    // 5. Extract audio via ffmpeg
    try {
      await runCommand('ffmpeg', [
        '-y',
        '-i', videoPath,
        '-vn',
        '-acodec', 'libmp3lame',
        '-ar', '16000',
        '-ac', '1',
        '-b:a', '128k',
        audioPath
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown audio extraction error';
      console.error('[API] ffmpeg extraction failed:', msg);
      return NextResponse.json(
        { error: 'Failed to extract audio from the downloaded Reel.' },
        { status: 500 }
      );
    }

    // Double check if audio file exists and is not empty
    if (!fs.existsSync(audioPath)) {
      return NextResponse.json(
        { error: 'Extracted audio file was not found on disk.' },
        { status: 500 }
      );
    }

    const audioStats = fs.statSync(audioPath);
    if (audioStats.size === 0) {
      return NextResponse.json(
        { error: 'Extracted audio file is empty.' },
        { status: 500 }
      );
    }

    console.log('[API] Audio extraction successful. Transcribing via Whisper...');

    // 6. Transcribe via Whisper
    let transcriptText = '';
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'json',
      });
      transcriptText = transcription.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown transcription error';
      console.error('[API] Whisper API error:', msg);
      return NextResponse.json(
        { error: `Whisper API transcription failed: ${msg}` },
        { status: 500 }
      );
    }

    console.log('[API] Transcription completed successfully.');

    // 7. Return Transcript
    return NextResponse.json({
      success: true,
      transcript: transcriptText,
    });

  } catch (error) {
    console.error('[API] Unexpected error:', error);
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  } finally {
    // 8. Clean Up Temp Files
    if (videoPath && fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
        console.log(`[API] Deleted temp video: ${videoPath}`);
      } catch (err) {
        console.error(`[API] Failed to delete temp video: ${videoPath}`, err);
      }
    }
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
        console.log(`[API] Deleted temp audio: ${audioPath}`);
      } catch (err) {
        console.error(`[API] Failed to delete temp audio: ${audioPath}`, err);
      }
    }
  }
}
