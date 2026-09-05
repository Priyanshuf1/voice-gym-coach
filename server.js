const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Config check endpoint
app.get('/api/config', (req, res) => {
  const apiKey = process.env.RIME_API_KEY;
  const isConfigured = !!apiKey && apiKey !== 'your_rime_api_key_here' && apiKey.trim().length > 10;
  res.json({
    isRimeConfigured: isConfigured,
    model: 'coda',
    defaultSpeaker: 'celeste',
    voiceEngine: isConfigured ? 'Rime.ai TTS' : 'Fallback Local Speech (Add RIME_API_KEY to .env for Rime)'
  });
});

// Proxy endpoint for Rime.ai Text-To-Speech
app.post('/api/tts', async (req, res) => {
  const { text, speaker = 'celeste', modelId = 'coda' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
  }

  const apiKey = process.env.RIME_API_KEY;
  const isConfigured = !!apiKey && apiKey !== 'your_rime_api_key_here' && apiKey.trim().length > 10;

  if (!isConfigured) {
    return res.status(401).json({
      error: 'RIME_API_KEY not configured or using placeholder',
      fallback: true,
      text: text
    });
  }

  try {
    const rimeResponse = await fetch('https://users.rime.ai/v1/rime-tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/wav'
      },
      body: JSON.stringify({
        text,
        speaker,
        modelId
      })
    });

    if (!rimeResponse.ok) {
      const errText = await rimeResponse.text();
      console.error(`[Rime API Error] Status: ${rimeResponse.status}, Details:`, errText);
      return res.status(rimeResponse.status).json({
        error: `Rime API Error (${rimeResponse.status})`,
        details: errText,
        fallback: true
      });
    }

    const audioBuffer = await rimeResponse.arrayBuffer();
    const contentType = rimeResponse.headers.get('content-type') || 'audio/wav';

    res.set({
      'Content-Type': contentType,
      'Content-Length': audioBuffer.byteLength,
      'Cache-Control': 'no-cache'
    });

    return res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('[Server TTS Exception]', err);
    return res.status(500).json({
      error: 'Internal server error while contacting Rime TTS',
      details: err.message,
      fallback: true
    });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎙️ Voice Gym Coach server running at http://localhost:${PORT}`);
  console.log(`🔑 Rime API Key configured: ${process.env.RIME_API_KEY && process.env.RIME_API_KEY !== 'your_rime_api_key_here' ? 'YES' : 'NO (Add to .env)'}`);
});
