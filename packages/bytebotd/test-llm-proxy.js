const express = require('express');
const app = express();
app.use(express.json({ limit: '50mb' }));

// Simple mock LLM proxy for testing
app.post('/v1/chat/completions', (req, res) => {
  const { messages } = req.body;
  const lastMessage = messages?.[messages.length - 1];
  const content = Array.isArray(lastMessage?.content)
    ? lastMessage.content
        .map((part) =>
          typeof part === 'string' ? part : 'text' in part ? part.text : ''
        )
        .join(' ')
    : lastMessage?.content ?? '';

  let response = '';

  if (/which region contains/i.test(content)) {
    const regions = [
      'top-left',
      'top-center',
      'top-right',
      'middle-left',
      'middle-center',
      'middle-right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
    ];
    const index = Math.floor(Math.random() * regions.length);
    response = regions[index];
  } else if (/exact coordinates/i.test(content)) {
    const x = 350 + Math.random() * 300;
    const y = 200 + Math.random() * 200;
    response = JSON.stringify({ x, y });
  } else if (/left half or right half/i.test(content)) {
    response = Math.random() > 0.5 ? 'left half' : 'right half';
  } else if (/top half or bottom half/i.test(content)) {
    response = Math.random() > 0.5 ? 'top half' : 'bottom half';
  } else {
    response = 'middle-center';
  }

  res.json({
    choices: [
      {
        message: {
          role: 'assistant',
          content: response,
        },
      },
    ],
  });
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Test LLM proxy running on http://localhost:${PORT}`);
  console.log('This is a mock proxy for testing the Smart Focus system.');
  console.log('For production, configure BYTEBOT_LLM_PROXY_URL to your real LLM endpoint.');
});
