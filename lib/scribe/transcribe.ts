/**
 * Whisper transcription via OpenAI API.
 *
 * Returns segments with start/end timestamps and per-segment confidence (avg_logprob -> 0-1 score).
 * If transcription fails (rate limit, etc.), throws — caller marks session as transcription_failed.
 */

export interface TranscriptSegment {
  idx: number;
  start: number;
  end: number;
  text: string;
  confidence: number; // 0..1, derived from avg_logprob
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  model: string;
  duration_seconds: number;
}

const WHISPER_MODEL = 'whisper-1';
const TIMEOUT_MS = 5 * 60 * 1000; // 5 min for long recordings

/**
 * Whisper avg_logprob is typically -0.1 to -1.5. Convert to a 0-1 confidence.
 * -0.0 → 1.0, -0.5 → ~0.6, -1.0 → ~0.37, -2.0 → ~0.14
 */
function logprobToConfidence(avgLogprob: number | undefined): number {
  if (avgLogprob === undefined || avgLogprob === null) return 0.5;
  return Math.max(0, Math.min(1, Math.exp(avgLogprob)));
}

export async function transcribeAudio(audioBlob: Blob, filename: string = 'audio.webm'): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const form = new FormData();
  form.append('file', audioBlob, filename);
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  // Bias toward medical terminology
  form.append('prompt', 'Endocrinology visit. Diabetes mellitus, A1C, glucose, insulin, metformin, semaglutide, tirzepatide, basal, prandial, CGM, time in range, hypoglycemia, hyperglycemia, neuropathy, nephropathy, retinopathy.');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whisper transcription failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  const segments: TranscriptSegment[] = (data.segments ?? []).map((s: any, idx: number) => ({
    idx,
    start: s.start,
    end: s.end,
    text: s.text.trim(),
    confidence: logprobToConfidence(s.avg_logprob),
  }));

  return {
    text: data.text ?? '',
    segments,
    model: WHISPER_MODEL,
    duration_seconds: data.duration ?? 0,
  };
}
