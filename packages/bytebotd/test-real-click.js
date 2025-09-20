#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');

function loadModule(distPath, srcPath) {
  const distFull = path.join(__dirname, distPath);
  if (fs.existsSync(distFull)) {
    return require(distFull);
  }
  require('ts-node/register');
  const srcFull = path.join(__dirname, srcPath);
  return require(srcFull);
}

const fetchFn =
  typeof fetch === 'function'
    ? fetch.bind(globalThis)
    : (...args) =>
        import('node-fetch').then(({ default: f }) => f(...args));

async function callLLM(messages, { maxTokens = 128, temperature = 0 }) {
  const proxyUrl = process.env.BYTEBOT_LLM_PROXY_URL;
  if (!proxyUrl) {
    throw new Error('BYTEBOT_LLM_PROXY_URL not configured');
  }

  const model =
    process.env.BYTEBOT_SMART_FOCUS_MODEL || 'gpt-4-vision-preview';
  const payload = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages,
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (process.env.OPENAI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  }

  const response = await fetchFn(proxyUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `LLM request failed (${response.status} ${response.statusText}): ${body}`,
    );
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error('LLM response missing choices');
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) =>
        typeof part === 'string' ? part : 'text' in part ? part.text : '',
      )
      .join('');
  }

  return message.content ?? '';
}

function parseCoordinates(raw) {
  const trimmed = (raw || '').trim();
  try {
    const json = JSON.parse(trimmed);
    if (typeof json.x === 'number' && typeof json.y === 'number') {
      return { x: Math.round(json.x), y: Math.round(json.y) };
    }
  } catch (err) {
    // ignore
  }

  const match = trimmed.match(/(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const x = Number.parseFloat(match[1]);
  const y = Number.parseFloat(match[2]);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

async function performSmartFocusClick({
  description,
  computerUse,
  focusRegion,
}) {
  console.log(`🎯 Smart Focus targeting: "${description}"`);

  const fullScreenshot = await computerUse.action({ action: 'screenshot' });
  const regionPrompt = `
    Looking at this screenshot with a 3x3 region grid:
    - top-left, top-center, top-right
    - middle-left, middle-center, middle-right
    - bottom-left, bottom-center, bottom-right

    Which region contains: "${description}"?
    Respond with just the region name.
  `;

  const regionReply = await callLLM(
    [
      {
        role: 'system',
        content:
          'You identify regions of a desktop screenshot. Reply exactly with a region name such as "top-left".',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: regionPrompt.trim() },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${fullScreenshot.image}`,
              detail: 'low',
            },
          },
        ],
      },
    ],
    { maxTokens: 32 },
  );

  const regionName = regionReply.trim();
  console.log(`📍 Region identified as: ${regionName}`);

  const focusResult = await focusRegion.captureFocusedRegion(regionName, {
    gridSize: 25,
    enhance: true,
    includeOffset: true,
  });

  const precisePrompt = `
    This is a zoomed view of the ${regionName} region.
    The overlay grid shows global screen coordinates.
    Find "${description}" and reply ONLY with JSON: {"x": <number>, "y": <number>}.
  `;

  const coordReply = await callLLM(
    [
      {
        role: 'system',
        content:
          'You provide precise screen coordinates. Reply only with JSON: {"x":<number>,"y":<number>}.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: precisePrompt.trim() },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${focusResult.image.toString('base64')}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    { maxTokens: 64 },
  );

  const coords = parseCoordinates(coordReply);
  if (!coords) {
    throw new Error(`Unable to parse coordinates from response: ${coordReply}`);
  }

  console.log(`✅ Smart Focus located coordinates: (${coords.x}, ${coords.y})`);
  return coords;
}

async function testRealClick() {
  console.log('🖱️  Real Click Test with Smart Focus\n');

  if (!process.env.BYTEBOT_LLM_PROXY_URL) {
    console.error('❌ BYTEBOT_LLM_PROXY_URL not configured. Aborting.');
    return;
  }

  const { NutService } = loadModule(
    'dist/nut/nut.service',
    'src/nut/nut.service',
  );
  const { GridOverlayService } = loadModule(
    'dist/nut/grid-overlay.service',
    'src/nut/grid-overlay.service',
  );
  const { FocusRegionService } = loadModule(
    'dist/nut/focus-region.service',
    'src/nut/focus-region.service',
  );
  const { ComputerUseService } = loadModule(
    'dist/computer-use/computer-use.service',
    'src/computer-use/computer-use.service',
  );

  const nutService = new NutService();
  const gridService = new GridOverlayService();
  const focusService = new FocusRegionService(nutService, gridService);
  const computerUse = new ComputerUseService(
    nutService,
    gridService,
    focusService,
  );

  const target = process.argv[2] || 'File menu';
  console.log(`Attempting to click: "${target}"`);

  try {
    const coords = await performSmartFocusClick({
      description: target,
      computerUse,
      focusRegion: focusService,
    });

    if (!coords) {
      console.log('❌ Smart Focus did not return coordinates.');
      return;
    }

    console.log('🖱️  Executing click...');
    await nutService.mouseMoveEvent(coords);
    await nutService.mouseClickEvent('left');
    console.log('✅ Click executed!');
  } catch (error) {
    console.error('❌ Error during Smart Focus click:', error?.message || error);
  }
}

if (require.main === module) {
  testRealClick().catch((error) => {
    console.error('❌ Test crashed:', error);
    process.exitCode = 1;
  });
}

module.exports = { testRealClick };
