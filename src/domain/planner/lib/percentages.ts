const roundTo = (value: number, precision: number) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const normalizePercentValues = (
  values: number[],
  precision = 1,
): number[] => {
  const positiveIndexes = values.flatMap((value, index) =>
    value > 0 ? [index] : [],
  );
  const total = positiveIndexes.reduce((sum, index) => sum + values[index], 0);
  if (!positiveIndexes.length || total <= 0) return values;

  const result = values.map(() => 0);
  const lastIndex = positiveIndexes.at(-1)!;
  let allocated = 0;

  positiveIndexes.forEach((index) => {
    if (index === lastIndex) return;
    const normalized = roundTo((values[index] / total) * 100, precision);
    result[index] = normalized;
    allocated += normalized;
  });
  result[lastIndex] = roundTo(100 - allocated, precision);
  return result;
};
