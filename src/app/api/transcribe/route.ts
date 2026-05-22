import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import OpenAI from 'openai';
import { instagramGetUrl } from 'instagram-url-direct';

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

// Regex to validate Instagram and YouTube URLs
const URL_REGEX = /^https:\/\/(www\.)?(instagram\.com\/(reel|reels|p)\/|youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+.*$/;

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
    const { url, language, prompt } = body;
    const clientKey = request.headers.get('x-openai-api-key');
    const rapidApiKey = request.headers.get('x-rapidapi-key');
    const rapidApiHostRaw = request.headers.get('x-rapidapi-host');

    // 1. Validate Input
    if (!url) {
      return NextResponse.json(
        { error: 'Instagram Reel or YouTube URL is required.' },
        { status: 400 }
      );
    }

    if (!URL_REGEX.test(url.trim())) {
      return NextResponse.json(
        { error: 'Invalid URL format. Must be a valid Instagram Reel or YouTube URL.' },
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

    // 4. Download Reel
    let downloadSuccess = false;
    let downloadErrorMsg = '';

    let directAudioUrl = '';
    let hasDirectAudio = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawRapidData: any = null;

    const isInstagram = url.trim().includes('instagram.com');

    // Attempt 1: Native instagram-url-direct package (FREE, NO API KEY)
    if (isInstagram && !downloadSuccess) {
      console.log(`[API] Attempting to fetch via native instagram-url-direct...`);
      try {
        const igRes = await instagramGetUrl(url.trim());
        if (igRes && igRes.url_list && igRes.url_list.length > 0) {
          const directVideoUrl = igRes.url_list[0];
          console.log(`[API] Found direct video URL from instagram-url-direct. Downloading...`);
          await runCommand('yt-dlp', ['-o', videoPath, directVideoUrl]);
          downloadSuccess = true;
        } else {
          console.log(`[API] instagram-url-direct failed to find media URLs.`, igRes);
        }
      } catch (err) {
        console.error('[API] instagram-url-direct fetch error:', err);
      }
    }

    // Attempt 2: RapidAPI (if key and host provided AND it's an Instagram URL)
    if (isInstagram && rapidApiKey && rapidApiHostRaw && !downloadSuccess) {
      console.log(`[API] RapidAPI Key and Host provided. Attempting to fetch via RapidAPI...`);
      try {
        let rapidApiDomain = rapidApiHostRaw;
        let rapidApiFetchUrl = rapidApiHostRaw;
        
        if (rapidApiHostRaw.startsWith('http')) {
          const parsed = new URL(rapidApiHostRaw);
          rapidApiDomain = parsed.hostname;
          rapidApiFetchUrl = `${rapidApiHostRaw}${rapidApiHostRaw.includes('?') ? '&' : '?'}url=${encodeURIComponent(url.trim())}`;
        } else {
          rapidApiFetchUrl = `https://${rapidApiHostRaw}/?url=${encodeURIComponent(url.trim())}`;
        }

        const rapidRes = await fetch(rapidApiFetchUrl, {
          method: 'GET',
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': rapidApiDomain
          }
        });

        if (rapidRes.ok) {
          const rapidData = await rapidRes.json();
          rawRapidData = rapidData;
          let directVideoUrl = '';

          // Look for audio url first (some APIs separate them)
          if (rapidData) {
            if (rapidData.data?.audio_url) directAudioUrl = rapidData.data.audio_url;
            else if (rapidData.audio_url) directAudioUrl = rapidData.audio_url;
            else if (rapidData.music_info?.url) directAudioUrl = rapidData.music_info.url;
            else if (rapidData.audio) directAudioUrl = rapidData.audio;
          }

          // Look for video url
          if (rapidData && rapidData.data && rapidData.data.video_url) {
            directVideoUrl = rapidData.data.video_url;
          } else if (rapidData && rapidData.media && typeof rapidData.media === 'string') {
            directVideoUrl = rapidData.media;
          } else if (Array.isArray(rapidData) && rapidData.length > 0 && rapidData[0].media) {
            directVideoUrl = rapidData[0].media;
          } else if (rapidData && rapidData.videoUrl) {
             directVideoUrl = rapidData.videoUrl;
          } else if (rapidData && rapidData.url) {
             directVideoUrl = rapidData.url;
          } else if (rapidData && rapidData.data && Array.isArray(rapidData.data) && rapidData.data[0]?.video_url) {
             directVideoUrl = rapidData.data[0].video_url;
          }
          
          if (directAudioUrl) {
             console.log(`[API] Found direct AUDIO URL from RapidAPI. Downloading directly to audio file...`);
             await runCommand('yt-dlp', ['-o', audioPath, directAudioUrl]);
             downloadSuccess = true;
             hasDirectAudio = true;
          } else if (directVideoUrl) {
            console.log(`[API] Found direct video URL from RapidAPI. Downloading to disk...`);
            await runCommand('yt-dlp', ['-o', videoPath, directVideoUrl]);
            downloadSuccess = true;
          } else {
             console.log(`[API] RapidAPI response did not contain recognizable media URLs.`, rapidData);
             downloadErrorMsg = 'RapidAPI returned an unexpected format. Could not extract media URLs.';
          }
        } else {
           const errText = await rapidRes.text();
           console.log(`[API] RapidAPI request failed:`, errText);
           downloadErrorMsg = `RapidAPI failed with status ${rapidRes.status}`;
        }
      } catch (err) {
        console.error('[API] RapidAPI fetch error:', err);
        downloadErrorMsg = 'Failed to fetch from RapidAPI.';
      }
    }

    // Attempt 3: Fallback to direct yt-dlp download if all else failed
    if (!downloadSuccess) {
      console.log(`[API] Attempting download via yt-dlp fallback...`);
      try {
        await runCommand('yt-dlp', [
          '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '--no-playlist',
          '-o', videoPath,
          url.trim()
        ]);
        downloadSuccess = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown download error';
        console.error('[API] yt-dlp download failed:', msg);
        downloadErrorMsg = msg;
      }
    }

    if (!downloadSuccess) {
      return NextResponse.json(
        { error: `Failed to download the Reel. Ensure the RapidAPI Key is correct if using it, or the video might be private/blocked. Details: ${downloadErrorMsg}` },
        { status: 500 }
      );
    }

    // Check if the downloaded file is actually a video and not an HTML login wall (skip if we got direct audio)
    if (!hasDirectAudio && fs.existsSync(videoPath)) {
      const videoStats = fs.statSync(videoPath);
      if (videoStats.size < 20000) { // 20KB
        let preview = 'Unknown content';
        try {
          preview = fs.readFileSync(videoPath, 'utf8').substring(0, 100);
        } catch {
          // Ignore read errors
        }
        console.log(`[API] Downloaded file is too small (${videoStats.size} bytes). Likely an HTML error page. Preview: ${preview}`);
        return NextResponse.json(
          { error: 'The downloaded file was not a valid video. This usually means the Reel is private, deleted, or Instagram blocked the scraper. Please try a different RapidAPI host or check the URL.' },
          { status: 500 }
        );
      }
    }

    console.log('[API] Download successful. Extracting audio...');

    // 5. Extract audio via ffmpeg (High Quality)
    let audioExtracted = hasDirectAudio;
    
    if (!hasDirectAudio) {
      try {
        await runCommand('ffmpeg', [
          '-y',
          '-i', videoPath,
          '-vn',
          '-q:a', '0', // Best VBR quality for MP3
          audioPath
        ]);
        audioExtracted = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown audio extraction error';
        console.error('[API] ffmpeg extraction failed:', msg);
        
        if (msg.includes('does not contain any stream')) {
          console.log('[API] Video downloaded from RapidAPI had no audio stream. Falling back to yt-dlp to extract audio directly...');
          try {
            await runCommand('yt-dlp', [
              '-f', 'bestaudio/best',
              '--extract-audio',
              '--audio-format', 'mp3',
              '--no-playlist',
              '-o', audioPath,
              url.trim()
            ]);
            audioExtracted = true;
          } catch (ytErr) {
             console.error('[API] yt-dlp audio fallback failed:', ytErr);
          }
          
          if (!audioExtracted) {
            const debugInfo = rawRapidData ? ` API Response Keys: ${Object.keys(rawRapidData).join(', ')}. ` : '';
            return NextResponse.json(
              { error: `This video does not have an audio track, or the downloader failed to locate it.${debugInfo}Please try a different RapidAPI host.` },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            { error: `Failed to extract audio from the downloaded media. Details: ${msg}` },
            { status: 500 }
          );
        }
      }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whisperParams: any = {
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'json',
      };
      
      if (language) {
        whisperParams.language = language;
      }
      
      if (prompt) {
        whisperParams.prompt = prompt;
      }

      const transcription = await openai.audio.transcriptions.create(whisperParams);
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
