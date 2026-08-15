import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const NIM_API_KEY = process.env.NIM_API_KEY;
const NIM_BASE = 'https://integrate.api.nvidia.com/v1';

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Private NIM Proxy' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', keyConfigured: !!NIM_API_KEY });
});

app.post('/v1/chat/completions', async (req, res) => {
  if (!NIM_API_KEY) {
    return res.status(500).json({ error: { message: 'NIM_API_KEY not set' } });
  }

  try {
    const body = { ...req.body };
    body.stream = true;

    if (!body.max_tokens || body.max_tokens > 4096) {
      body.max_tokens = 2048;
    }

    // Enable thinking for Gemma models
    if (body.model && body.model.toLowerCase().includes('gemma')) {
      body.chat_template_kwargs = {
        enable_thinking: true
      };
    }

    const response = await axios({
      method: 'post',
      url: `${NIM_BASE}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${NIM_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      data: body,
      responseType: 'stream',
      timeout: 180000,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    response.data.pipe(res);
  } catch (err) {
    console.error(err.message);
    res.status(err.response?.status || 500).json({
      error: {
        message: err.response?.data?.error?.message || err.message || 'Upstream error',
      },
    });
  }
});

app.listen(PORT, () => {
  console.log(`Private NIM Proxy running on port ${PORT}`);
});
