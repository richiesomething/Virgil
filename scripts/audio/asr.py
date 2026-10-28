#!/usr/bin/env python3
"""Speech recognition with word timestamps for an audiobook chapter, as input to sync.mjs.

Downloads the chapter's MP3 from archive.org (cached), decodes it with ffmpeg, runs faster-whisper
(base.en, int8, CPU) and writes <out>/NNN.json: {"duration": s, "words": [[word, start, end], ...]}.

Usage: python3 scripts/audio/asr.py <item> <filePattern> <out-dir> <n> [<n2> ...]
  item         archive.org identifier, e.g. count_montecristo_1308_librivox
  filePattern  file name with NNN for the zero-padded chapter, e.g. countofmontecristo_NNN_dumas_64kb.mp3
"""
import json, os, subprocess, sys, time, urllib.request

import numpy as np
from faster_whisper import WhisperModel

item, pattern, out = sys.argv[1], sys.argv[2], sys.argv[3]
chapters = [int(x) for x in sys.argv[4:]]
os.makedirs(out, exist_ok=True)
cache = os.path.join(out, 'mp3')
os.makedirs(cache, exist_ok=True)

model = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=int(os.environ.get('ASR_THREADS', '4')))

for n in chapters:
    nnn = f'{n:03d}'
    dest = os.path.join(out, f'{nnn}.json')
    if os.path.exists(dest):
        continue
    mp3 = os.path.join(cache, f'{nnn}.mp3')
    if not os.path.exists(mp3):
        url = f'https://archive.org/download/{item}/{pattern.replace("NNN", nnn)}'
        for attempt in range(4):
            try:
                urllib.request.urlretrieve(url, mp3 + '.part')
                os.rename(mp3 + '.part', mp3)
                break
            except Exception as e:  # archive.org drops connections now and then
                print(f'{nnn}: download failed ({e}), retrying', flush=True)
                time.sleep(5 * (attempt + 1))
        else:
            raise SystemExit(f'{nnn}: could not download {url}')
    # 16 kHz mono float32, straight from ffmpeg (faster-whisper's own decoder needs a newer PyAV).
    pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', mp3, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
    duration = len(audio) / 16000
    t = time.time()
    segments, _ = model.transcribe(audio, word_timestamps=True, beam_size=1, vad_filter=True, condition_on_previous_text=False)
    words = [[w.word.strip(), round(float(w.start), 2), round(float(w.end), 2)] for s in segments for w in s.words if w.word.strip()]
    json.dump({'duration': round(duration, 2), 'words': words}, open(dest, 'w'))
    print(f'{nnn}: {duration/60:.1f} min, {len(words)} words, {time.time()-t:.0f}s', flush=True)
