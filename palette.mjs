export function resolvePalette(settings, theme) {
  if (settings.palette === 'custom') return { ink: settings.ink, accent: settings.accent, paper: settings.paper, daylight: theme.isDaylight };
  const daylight = settings.palette === 'day' || (settings.palette !== 'night' && theme.isDaylight);
  return daylight
    ? { ink: '#293438', accent: '#805021', paper: '#f3efe5', daylight: true }
    : { ink: '#eee9d5', accent: '#d8c796', paper: '#080b0e', daylight: false };
}
