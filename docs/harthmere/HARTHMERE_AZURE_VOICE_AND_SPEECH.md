# Harthmere Voice And Speech

The runtime now supports two selectable NPC text-to-speech providers:

- **ElevenLabs** is the default and uses natural account voices with stable
  per-NPC casting.
- **OpenAI / Azure** preserves the existing Azure AI Speech voice path.

Azure OpenAI Responses still generates dynamic NPC text, and Azure AI Speech
still handles player speech-to-text. NPC speech can be switched off entirely;
dialogue always remains readable as text when any external service is missing.

The ElevenLabs key is server-only. The browser sends only the selected provider,
NPC voice descriptor, language, and dialogue text to the authenticated Biomes
API route; it never receives the provider credential.

For production, store the value as the GitHub `production` environment secret
`ELEVENLABS_API_KEY`. The Azure deployment workflow copies that masked value to
the Container App secret `elevenlabs-api-key` before applying the revision. For
local development, use the gitignored `.env.local` file and restrict it to the
current OS user; never place the value in an example file or tracked document.

## Verified Azure Resources

The Azure CLI checks on June 7, 2026 found:

- `glitch-openai-instance` is an Azure OpenAI resource in `eastus`.
- `glitch-openai-instance` has a `gpt-5.5` deployment with model version
  `2026-04-24`, Global Standard capacity `5292`, `5292` requests/minute, and
  `5,292,000` tokens/minute.
- `devin-md9b1bq5-eastus2` is an Azure AI Services resource in `eastus2`.
- `devin-md9b1bq5-eastus2` has Azure OpenAI audio deployments including
  `whisper`, `gpt-realtime-whisper`, `gpt-4o-mini-tts`, and `gpt-audio`.
- Azure AI Speech TTS and STT were verified from `eastus2` with a generated WAV:
  the voices list returned successfully, synthesis returned audio, and short
  speech recognition returned text.
- The configured Azure Speech region returned 713 voices, including 196 English
  voices, 59 English HD voices, and 29 English voices with speaking-style
  metadata.

Use these commands to re-check access and quotas:

```bash
az account show -o table

az cognitiveservices account list \
  --resource-group openai-resource-group \
  --query "[].{name:name,kind:kind,location:location,endpoint:properties.endpoint,sku:sku.name}" \
  -o table

az cognitiveservices account deployment list \
  --resource-group openai-resource-group \
  --name glitch-openai-instance \
  --query "[].{name:name,model:properties.model.name,version:properties.model.version,sku:sku.name,capacity:sku.capacity,rateLimits:properties.rateLimits}" \
  -o json

az cognitiveservices account deployment list \
  --resource-group openai-resource-group \
  --name devin-md9b1bq5-eastus2 \
  --query "[?contains(properties.model.name, 'audio') || contains(properties.model.name, 'whisper') || contains(properties.model.name, 'tts') || contains(properties.model.name, 'transcribe') || contains(properties.model.name, 'realtime')].{name:name,model:properties.model.name,version:properties.model.version,sku:sku.name,capacity:sku.capacity,rateLimits:properties.rateLimits,capabilities:properties.capabilities}" \
  -o json

az cognitiveservices usage list \
  --location eastus2 \
  --query "[?contains(name.value, 'OpenAI') && (contains(name.value, 'audio') || contains(name.value, 'whisper') || contains(name.value, 'tts') || contains(name.value, 'transcribe') || contains(name.value, 'realtime'))].{name:name.value,current:currentValue,limit:limit,unit:unit}" \
  -o table
```

To create an Azure OpenAI deployment when quota is available:

```bash
az cognitiveservices account deployment create \
  --resource-group openai-resource-group \
  --name devin-md9b1bq5-eastus2 \
  --deployment-name whisper \
  --model-format OpenAI \
  --model-name whisper \
  --model-version 001 \
  --sku-name Standard \
  --sku-capacity 3
```

Do not print or commit account keys. Fetch keys only for local smoke tests and
export them into your shell:

```bash
export AZURE_SPEECH_REGION=eastus2
export AZURE_SPEECH_KEY="$(az cognitiveservices account keys list \
  --resource-group openai-resource-group \
  --name devin-md9b1bq5-eastus2 \
  --query key1 -o tsv)"
```

## Runtime Configuration

Optional environment variables:

```bash
ELEVENLABS_API_KEY=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128

# Optional comma-separated cast overrides. When omitted, the server discovers
# available account voices and chooses a stable, gender-matched cast per NPC.
ELEVENLABS_VOICE_IDS=
ELEVENLABS_FEMALE_VOICE_IDS=
ELEVENLABS_MALE_VOICE_IDS=
ELEVENLABS_NEUTRAL_VOICE_IDS=

AZURE_OPENAI_ENDPOINT=https://glitch-openai-instance.openai.azure.com/
AZURE_OPENAI_API_VERSION=2025-04-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-5.5
AZURE_OPENAI_API_KEY=

AZURE_SPEECH_REGION=eastus2
AZURE_SPEECH_KEY=
```

Player defaults:

- NPC speech is enabled.
- ElevenLabs is selected as the NPC voice provider.
- The Options screen can switch to the existing OpenAI / Azure provider or turn
  NPC speech off without affecting written dialogue.

If provider credentials are absent or a request fails:

- `/api/voices/speech_status` reports each TTS provider independently.
- Text-to-speech returns `{ "url": "" }` for the selected unavailable provider.
- Speech-to-text returns an empty text result with `unavailableReason`.
- NPC dialogue still works as normal text.

The microphone control depends on Azure Speech-to-text and Azure OpenAI
generated chat, not on NPC text-to-speech. This means players can still hold
`T`, speak, and receive a written NPC response when NPC audio is turned off.

## Voice Assignment

Shared voice assignment lives in:

```text
src/shared/harthmere/npc_voice_profiles.ts
src/shared/harthmere/npc_voice_catalog.ts
```

Conversation tone and influence mapping for the current NPC cast lives in:

```text
docs/harthmere/HARTHMERE_NPC_CONVERSATION_TONE_MAP.md
```

The runtime delivery rules live in:

```text
src/shared/harthmere/npc_speech_delivery.ts
```

Those rules shape Azure SSML with actor-specific cadence and also provide the
actor identity, presentation, kind, and speed hints used for ElevenLabs casting.

The catalog assigns every authored Harthmere NPC/living entity a stable
`voiceParameterId`:

```text
azure-speech|voice=en-US-LunaNeural|gender=female|kind=humanoid|style=conversation|styleDegree=0.95|rate=-3%|pitch=+1%|volume=default|break=150|actor=...
```

The assignment uses:

- stable actor identity: source, id, entity id, name;
- authored role/kind/background/voice style;
- inferred presentation when no explicit sex/gender field exists;
- Azure Speech neural voice short names that were verified from the configured
  Speech region;
- speaking style where the voice supports it, such as `conversation`, `chat`,
  `friendly`, `empathetic`, `serious`, `relieved`, or `whispering`;
- conservative per-actor prosody: rate, pitch, volume, style degree, and
  sentence/phrase break timing.

This gives a deterministic voice that can be stored in the ECS `Voice`
component and reused for dynamic responses or static recording generation.

For ElevenLabs, the server queries `GET /v2/voices`, prefers voices compatible
with the configured quality model, matches authored/inferred presentation when
labels are available, and hashes the actor identity into the resulting pool.
The default model is `eleven_multilingual_v2`; operators can choose a lower
latency model with `ELEVENLABS_MODEL_ID`. Explicit environment voice pools take
priority over account discovery.

A restricted key only needs text-to-speech access. If it does not include the
optional `voices_read` permission, the server caches that discovery restriction
and uses its deterministic premade fallback cast without exposing or weakening
the credential. Grant `voices_read` only when production should discover custom
or account-managed voices automatically.

## Making Speech Less AI-Sounding

Use both providers as cast performances, not as one global narrator:

- keep NPC lines short enough to breathe;
- prefer contractions and concrete local detail;
- avoid stage directions, brackets, assistant disclaimers, and long lore dumps;
- vary voice, speaking style, rate, pitch, and sentence breaks per character;
- use `mstts:express-as` for style-capable voices, but keep `styledegree`
  modest so characters do not sound like exaggerated demos;
- keep pitch and rate shifts small for humanoids, larger for robots/creatures
  only;
- insert sentence-level SSML breaks instead of forcing one flat paragraph;
- write dynamic prompts for spoken dialogue, not essay responses;
- use different voice pools for masculine, feminine, neutral, robot, creature,
  and animal-like actors;
- avoid production default styles that sound like assistants, call centers,
  newscasters, or audiobook narration unless a specific NPC is authored that
  way;
- reserve custom/personal voice cloning for cases with explicit consent and the
  correct provider permissions.

The June 7, 2026 Azure voice audit also found newer MAI voices and Azure OpenAI
audio deployments. They remain available through the existing provider, while
ElevenLabs is now the default player setting for dynamic NPC speech.

## Static NPC Recordings

Static lines are generated from the voice catalog. Dry-run first:

```bash
node scripts/harthmere/generate-harthmere-npc-voice-recordings.cjs --dry-run
```

Generate a limited batch:

```bash
AZURE_SPEECH_REGION=eastus2 \
AZURE_SPEECH_KEY="$AZURE_SPEECH_KEY" \
node scripts/harthmere/generate-harthmere-npc-voice-recordings.cjs --limit=25
```

The script writes MP3s and a manifest under:

```text
public/harthmere/voices/generated/current/
```

These generated audio files can be produced in a controlled asset pass. They are
not required for normal dynamic TTS playback.

## Hold-To-Talk And Speak Button Flow

When speech input is available, NPC dialogue shows a small microphone button and
the indicator `Press T to talk` after the dialogue text has finished typing and
the normal options are visible. Clicking the button keeps the previous
start/stop behavior. Holding `T` starts listening; releasing `T` stops capture
and submits the recording.

While held, the UI displays `Listening… release T to send`. While speech is
being transcribed and interpreted, it displays `Interpreting…`. Recording also
stops safely at the configured time limit, on focus loss, or when the dialog is
closed. The shortcut ignores key repeat, modifier combinations, and editable
fields.

Flow:

1. Browser records microphone audio as mono 16 kHz PCM WAV.
2. Client posts base64 WAV to `/api/voices/speech_to_text`.
3. Server sends the WAV to Azure AI Speech short recognition.
4. The transcript is sent to `/api/npcs/generated_chat`.
5. The NPC prompt includes the NPC background and, when applicable, active
   quest context for that NPC.
6. The response text is sent to `/api/voices/text_to_speech` with the player's
   selected NPC voice provider.
7. ElevenLabs or the existing Azure Speech provider returns audio and the NPC
   speaks back in its assigned voice. If NPC speech is off or unavailable, the
   response remains text-only.

If the player has an active quest for that NPC, voice-driven responses include
the quest name, state, current dialogue, and primary/decline actions as context.
When the quest is not `in_progress`, that quest context is not sent and the NPC
returns to normal dialogue behavior.
