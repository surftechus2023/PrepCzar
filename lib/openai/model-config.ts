const DEFAULT_ALLOWED_MODELS = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'o3',
  'o3-mini',
];

function configuredAllowlist() {
  return (process.env.OPENAI_ALLOWED_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

export function allowedOpenAIModels() {
  const configured = configuredAllowlist();
  return configured.length ? configured : DEFAULT_ALLOWED_MODELS;
}

export function resolveConfiguredModel(envVarName: string, fallbackModel: string) {
  const requested = (process.env[envVarName] || fallbackModel).trim();
  const allowed = allowedOpenAIModels();
  if (allowed.includes(requested)) return requested;
  if (allowed.includes(fallbackModel)) return fallbackModel;
  return allowed[0] || fallbackModel;
}
