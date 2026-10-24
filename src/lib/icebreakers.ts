// Una pregunta para arrancar la charla después de cada encuentro. Las dos personas ven la misma.
const QUESTIONS = [
  "¿Qué plan te gustaría que exista en Rosario y nunca encontrás con quién hacer?",
  "¿Cuál es tu lugar favorito de la ciudad para un sábado a la tarde?",
  "¿Qué es lo último que aprendiste a hacer?",
  "¿A qué te dedicás, explicado como para alguien de cinco años?",
  "¿Cuál fue el mejor plan que hiciste este año?",
  "¿Qué recomendás comer o tomar acá?",
  "¿Qué deporte o actividad te gustaría probar?",
  "¿Cómo te enteraste de este plan?",
  "¿Qué estás escuchando últimamente?",
  "¿Cuál es tu bodegón o bar preferido de Rosario?",
];

export function icebreakerFor(encounterId: string | number) {
  return QUESTIONS[Number(encounterId) % QUESTIONS.length];
}
