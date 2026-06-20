# Harthmere Azure Voice And Speech

This project uses Azure only for NPC voice work:

- Azure OpenAI Responses for dynamic NPC text.
- Azure AI Speech for text-to-speech and speech-to-text.
- No other voice provider is called. If the Azure deployment is not configured,
  voice controls stay hidden and dialogue stays text-only.

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
AZURE_OPENAI_ENDPOINT=https://glitch-openai-instance.openai.azure.com/
AZURE_OPENAI_API_VERSION=2025-04-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-5.5
AZURE_OPENAI_API_KEY=

AZURE_SPEECH_REGION=eastus2
AZURE_SPEECH_KEY=
```

If any of the required Azure variables are absent:

- `/api/voices/speech_status` reports the capability as disabled.
- The small microphone button is hidden.
- Text-to-speech returns `{ "url": "" }`.
- Speech-to-text returns an empty text result with `unavailableReason`.
- NPC dialogue still works as normal text.

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

Those rules shape each Azure SSML request with actor-specific cadence, line
aware pauses, modest rate/pitch shifts, and prompt briefs for dynamic generated
chat.

The catalog assigns every authored Harthmere NPC/living entity a stable
`voiceParameterId`:

```text
azure-speech|voice=en-US-LunaNeural|style=conversation|styleDegree=0.95|rate=-3%|pitch=+1%|volume=default|break=150|actor=...
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

## Making Speech Less AI-Sounding

Use Azure Speech voices as cast performances, not as one global narrator:

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
  correct Azure feature approval.

The June 7, 2026 Azure voice audit also found newer MAI voices and Azure OpenAI
audio deployments. They are documented as available Azure resources, but the
production NPC path remains Azure Speech-only and defaults to stable
style-capable neural voices instead of switching providers.

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

## Speak Button Flow

When Azure voice is active, NPC dialogue shows a small microphone button after
the dialogue text has finished typing and the normal options are visible.

Flow:

1. Browser records microphone audio as mono 16 kHz PCM WAV.
2. Client posts base64 WAV to `/api/voices/speech_to_text`.
3. Server sends the WAV to Azure AI Speech short recognition.
4. The transcript is sent to `/api/npcs/generated_chat`.
5. The NPC prompt includes the NPC background and, when applicable, active
   quest context for that NPC.
6. The response text is sent to `/api/voices/text_to_speech`.
7. Azure AI Speech returns MP3 audio and the NPC speaks back in its assigned
   voice.

If the player has an active quest for that NPC, voice-driven responses include
the quest name, state, current dialogue, and primary/decline actions as context.
When the quest is not `in_progress`, that quest context is not sent and the NPC
returns to normal dialogue behavior.
