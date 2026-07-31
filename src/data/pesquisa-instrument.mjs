/**
 * Versioned anonymous community census instrument.
 * Shared by the survey UI and Netlify Functions (import via relative path).
 */

export const SURVEY_ID = 'community-v1';

/** Minimum total responses before public charts are shown. */
export const MIN_RESPONSES_TO_PUBLISH = 10;

/** Counts below this are folded into "outros_oculto" on the public API. */
export const MIN_BUCKET_COUNT = 3;

export const PREFER_NOT = 'pnd';

export const questions = [
  {
    id: 'age',
    label: 'Faixa etária',
    options: [
      { id: '18-24', label: '18–24' },
      { id: '25-34', label: '25–34' },
      { id: '35-44', label: '35–44' },
      { id: '45-54', label: '45–54' },
      { id: '55plus', label: '55+' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'gender',
    label: 'Identidade de género',
    options: [
      { id: 'woman', label: 'Mulher' },
      { id: 'man', label: 'Homem' },
      { id: 'nonbinary', label: 'Não-binário' },
      { id: 'other', label: 'Outra' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'orientation',
    label: 'Orientação sexual',
    options: [
      { id: 'hetero', label: 'Hétero' },
      { id: 'gay_lesbian', label: 'Gay / lésbica' },
      { id: 'bi', label: 'Bissexual' },
      { id: 'pan', label: 'Pansexual' },
      { id: 'ace', label: 'Assexual / ace' },
      { id: 'other', label: 'Outra' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'relational',
    label: 'Orientação / prática relacional',
    options: [
      { id: 'poly', label: 'Poliamor' },
      { id: 'open', label: 'Relação aberta' },
      { id: 'swing', label: 'Swing' },
      { id: 'ra', label: 'Anarquia relacional' },
      { id: 'exploring', label: 'Em exploração / transição' },
      { id: 'other', label: 'Outra' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'status',
    label: 'Situação relacional',
    options: [
      { id: 'none', label: 'Sem relação' },
      { id: 'one', label: 'Uma relação' },
      { id: 'multiple', label: 'Múltiplas relações' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'enm_time',
    label: 'Há quanto tempo exploras não-monogamia?',
    options: [
      { id: 'lt1', label: 'Menos de 1 ano' },
      { id: '1-3', label: '1–3 anos' },
      { id: '3-5', label: '3–5 anos' },
      { id: '5plus', label: 'Mais de 5 anos' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'community_time',
    label: 'Há quanto tempo conheces / participas nesta comunidade?',
    options: [
      { id: 'first', label: 'Primeira participação' },
      { id: 'lt6m', label: 'Menos de 6 meses' },
      { id: '6-24m', label: '6–24 meses' },
      { id: '2plus', label: '2 ou mais anos' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'zone',
    label: 'Zona (aproximada)',
    options: [
      { id: 'porto_city', label: 'Porto cidade' },
      { id: 'amp', label: 'Área Metropolitana do Porto' },
      { id: 'north', label: 'Norte (fora da AMP)' },
      { id: 'other_pt', label: 'Outro Portugal' },
      { id: 'abroad', label: 'Fora de Portugal' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'frequency',
    label: 'Frequência em tertúlias / eventos',
    options: [
      { id: 'regular', label: 'Regularmente' },
      { id: 'sometimes', label: 'Às vezes' },
      { id: 'rarely', label: 'Raramente' },
      { id: 'never', label: 'Ainda não participei' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
  {
    id: 'discovery',
    label: 'Como soubeste da comunidade?',
    options: [
      { id: 'friends', label: 'Amizades' },
      { id: 'social', label: 'Redes sociais' },
      { id: 'event', label: 'Evento' },
      { id: 'site', label: 'Este site' },
      { id: 'other', label: 'Outro' },
      { id: PREFER_NOT, label: 'Prefiro não dizer' },
    ],
  },
];

/** Questions highlighted on Quem Somos charts. */
export const chartQuestionIds = ['age', 'gender', 'relational', 'zone', 'frequency'];

/**
 * @param {Record<string, string>} answers
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateAnswers(answers) {
  if (!answers || typeof answers !== 'object') {
    return { ok: false, error: 'Respostas em falta' };
  }
  for (const q of questions) {
    const value = answers[q.id];
    if (!value || typeof value !== 'string') {
      return { ok: false, error: `Resposta em falta: ${q.id}` };
    }
    if (!q.options.some((o) => o.id === value)) {
      return { ok: false, error: `Opção inválida: ${q.id}` };
    }
  }
  return { ok: true };
}

export function optionLabel(questionId, optionId) {
  if (optionId === 'outros_oculto') return 'Outros / oculto';
  const q = questions.find((item) => item.id === questionId);
  return q?.options.find((o) => o.id === optionId)?.label || optionId;
}
