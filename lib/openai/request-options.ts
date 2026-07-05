export function supportsCustomTemperature(model: string) {
  return !/^(gpt-5|o\d|o-)/i.test(model);
}

export function temperatureOption(model: string, temperature: number) {
  return supportsCustomTemperature(model) ? { temperature } : {};
}
