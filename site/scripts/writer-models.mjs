import { WriterError } from './writer-error.mjs';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const dateOnly = (text) => {
  if (typeof text !== 'string' || !DATE_ONLY.test(text)) return null;
  const time = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== text ? null : text;
};

export function normalizeOpenAiModels(payload) {
  if (!Array.isArray(payload?.data)) throw new WriterError('vendor', 'the openai model list has no data array');
  return payload.data
    .filter((entry) => typeof entry?.id === 'string')
    .map((entry) => ({ id: entry.id, shutdownDate: dateOnly(entry.shutdown_date) }));
}

export const shutdownNote = ({ model, modelVariable, shutdownDate }) =>
  `${modelVariable} is ${model}, which its vendor has announced it will shut down on ${shutdownDate}.`;

export function checkModel({ model, modelVariable, models }) {
  const found = models.find((candidate) => candidate.id === model);
  if (!found) {
    const message = `${modelVariable} is ${JSON.stringify(model)}, which is not in the vendor's model list`;
    throw new WriterError('model', message, { variables: [modelVariable] });
  }
  const note = found.shutdownDate ? shutdownNote({ model, modelVariable, shutdownDate: found.shutdownDate }) : null;
  return { id: found.id, shutdownDate: found.shutdownDate, note };
}
