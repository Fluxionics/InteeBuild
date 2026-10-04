'use strict';

const { normalizeConfig, OUTPUT_FORMATS } = require('../generator/config');

const SYSTEM_PROMPT = `Eres un experto en InteeBuild. Genera config JSON válido para compilar apps Android/iOS.
Campos obligatorios: url, appName, packageName, outputType, platform, provider, versionName, versionCode, compileSdk, targetSdk, minSdk, permissions, outputs
Campos opcionales: splashEnabled, splashImageBase64, splashAnimation, splashDuration, splashBgColor, themeColor, navBarTransparent, webviewPullToRefresh, webviewPinchZoom, webviewHideScrollbars, webviewDisableCopy, webviewDisableLongPress, privacyMode, privacyBlockAds, privacyBlockTracking, privacyBlockCookies, privacyBlockGeolocation, privacyBlockRedirects, privacyCustomBlocklist, autoDetectPermissions, fcmEnabled, fcmServerKey, fcmSenderId, apnsEnabled, apnsKeyId, apnsTeamId, apnsBundleId, apnsAuthKeyBase64, pushWebhookUrl, bgModes, iconMonochromeBase64, iconRoundBase64, tvEnabled, tvBannerBase64, wearEnabled, watchFaceEnabled, complicationsEnabled, chromeosEnabled, chromeosOptimizations, signingEnabled, keystoreBase64, keystorePassword, keyAlias, keyPassword, iconBase64, adaptiveIconEnabled, adaptiveForegroundBase64, adaptiveBackgroundColor

Responde SOLO con JSON válido. Sin markdown, sin explicaciones adicionales.
Formato de respuesta:
{
  "config": { ... },
  "explanation": "Explicación breve en español de lo configurado"
}`;

function buildUserPrompt(prompt, locale = 'es') {
  const lang = locale === 'en' ? 'Respond in English' : 'Responde en español';
  return `${lang}. Usuario: "${prompt}"`;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  return JSON.parse(match[0]);
}

async function callLLM(prompt, locale) {
  const apiKey = process.env.AI_API_KEY;
  const provider = process.env.AI_PROVIDER || 'openai';
  
  if (!apiKey) {
    throw new Error('AI_API_KEY not configured');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(prompt, locale) }
  ];

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages
      })
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    const data = await res.json();
    return data.content[0].text;
  }

  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      temperature: 0.3,
      messages
    })
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

function validateConfig(config) {
  const required = ['url', 'appName', 'packageName', 'outputType', 'platform', 'provider', 'versionName', 'versionCode', 'compileSdk', 'targetSdk', 'minSdk', 'permissions', 'outputs'];
  for (const field of required) {
    if (config[field] === undefined) {
      throw new Error(`Campo obligatorio faltante: ${field}`);
    }
  }
  
  if (!OUTPUT_FORMATS.some(f => config.outputs.includes(f))) {
    throw new Error('Formato de salida inválido');
  }
  
  if (!['android', 'ios', 'both', 'tv', 'wear', 'chromeos', 'all'].includes(config.platform)) {
    throw new Error('Plataforma inválida');
  }
  
  if (!['capacitor', 'native', 'twa', 'gecko', 'cordova', 'flutter', 'tauri', 'ios', 'desktop'].includes(config.provider)) {
    throw new Error('Provider inválido');
  }

  return true;
}

module.exports = function registerAIRoutes(app, ctx) {
  app.post('/api/ai/generate-config', async (req, res) => {
    try {
      const { prompt, locale = 'es' } = req.body;
      
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
        return res.status(400).json({ error: 'Prompt demasiado corto. Mínimo 10 caracteres.' });
      }
      
      if (prompt.length > 2000) {
        return res.status(400).json({ error: 'Prompt demasiado largo. Máximo 2000 caracteres.' });
      }

      const apiKey = process.env.AI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: 'AI no configurado' });
      }

      const llmResponse = await callLLM(prompt.trim(), locale);
      const parsed = extractJson(llmResponse);
      
      if (!parsed.config || !parsed.explanation) {
        throw new Error('Respuesta IA inválida: falta config o explanation');
      }

      validateConfig(parsed.config);
      
      
      const normalized = normalizeConfig(parsed.config);
      
      res.json({
        config: normalized,
        explanation: parsed.explanation
      });
    } catch (e) {
      console.error('[AI] Error:', e.message);
      if (e.message.includes('AI_API_KEY')) {
        return res.status(503).json({ error: 'AI no configurado' });
      }
      if (e.message.includes('inválida') || e.message.includes('faltante') || e.message.includes('JSON')) {
        return res.status(400).json({ error: 'Respuesta IA inválida: ' + e.message });
      }
      res.status(500).json({ error: 'Error generando config: ' + e.message });
    }
  });
};