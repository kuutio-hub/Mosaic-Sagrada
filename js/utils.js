export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}
