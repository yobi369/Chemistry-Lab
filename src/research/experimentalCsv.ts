import { SimulationInputError } from './gillespie';

export interface ExperimentalMeasurement {
  readonly experimentId: string;
  readonly experimentLabel: string;
  readonly timeHours: number;
  readonly hydrogenMicromoles: number;
  readonly standardDeviationMicromoles: number;
  readonly sourceRow: number;
  readonly sourceColumn: number;
}
export interface ExperimentalDataset {
  readonly source: string;
  readonly measurements: readonly ExperimentalMeasurement[];
  readonly experimentLabels: readonly string[];
  readonly audit: {
    readonly experimentCount: number;
    readonly measurementCount: number;
    readonly negativeHydrogenMeasurements: number;
    readonly zeroStandardDeviationMeasurements: number;
    readonly maximumTimeHours: number;
  };
}
export class ExperimentalCsvError extends Error {
  constructor(message: string) { super(message); this.name = 'ExperimentalCsvError'; }
}

function parseRecord(line: string, lineNumber: number): string[] {
  const fields: string[] = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { value += '"'; i++; }
        else quoted = false;
      } else value += c;
    } else if (c === ',') { fields.push(value); value = ''; }
    else if (c === '"' && value.length === 0) quoted = true;
    else value += c;
  }
  if (quoted) throw new ExperimentalCsvError('Unclosed quoted field on row ' + lineNumber + '.');
  fields.push(value);
  return fields;
}
function numeric(value: string, label: string, row: number, column: number): number {
  if (value.trim() === '') throw new ExperimentalCsvError('Missing ' + label + ' at row ' + row + ', column ' + column + '.');
  const result = Number(value);
  if (!Number.isFinite(result)) throw new ExperimentalCsvError('Non-finite ' + label + ' at row ' + row + ', column ' + column + '.');
  return result;
}

/** Strictly imports the published two-header-row, three-columns-per-series CSV. */
export function importQinTratnyek2018Csv(csv: string, source = '10.5281/zenodo.1979080'): ExperimentalDataset {
  const lines = csv.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (lines.length < 3) throw new ExperimentalCsvError('CSV requires two header rows and data.');
  const labels = parseRecord(lines[0], 1);
  const headers = parseRecord(lines[1], 2);
  if (!headers.length || labels.length !== headers.length || headers.length % 3 !== 0)
    throw new ExperimentalCsvError('Expected three columns per experiment.');
  const experimentLabels: string[] = [];
  for (let c = 0; c < headers.length; c += 3) {
    const label = labels[c].trim();
    if (!label || labels[c + 1].trim() || labels[c + 2].trim())
      throw new ExperimentalCsvError('Malformed label group at column ' + (c + 1) + '.');
    if (headers[c].trim() !== 'time_hr' || headers[c + 1].trim() !== 'H2_aver_uMol' || headers[c + 2].trim() !== 'H2_stdev')
      throw new ExperimentalCsvError('Unexpected column headers for ' + label + '.');
    experimentLabels.push(label);
  }
  const measurements: ExperimentalMeasurement[] = [];
  for (let r = 2; r < lines.length; r++) {
    if (!lines[r].trim()) continue;
    const cells = parseRecord(lines[r], r + 1);
    if (cells.length !== headers.length)
      throw new ExperimentalCsvError('Row ' + (r + 1) + ' has ' + cells.length + ' cells; expected ' + headers.length + '.');
    for (let c = 0; c < cells.length; c += 3) {
      const triplet = cells.slice(c, c + 3);
      if (triplet.every(x => x.trim() === '')) continue;
      const label = experimentLabels[c / 3];
      if (triplet.some(x => x.trim() === ''))
        throw new ExperimentalCsvError('Partially missing triplet for ' + label + ' at row ' + (r + 1) + '.');
      const timeHours = numeric(triplet[0], 'time_hr', r + 1, c + 1);
      const hydrogenMicromoles = numeric(triplet[1], 'H2_aver_uMol', r + 1, c + 2);
      const standardDeviationMicromoles = numeric(triplet[2], 'H2_stdev', r + 1, c + 3);
      if (timeHours < 0) throw new ExperimentalCsvError('Negative time at row ' + (r + 1) + '.');
      if (standardDeviationMicromoles < 0) throw new ExperimentalCsvError('Negative SD at row ' + (r + 1) + '.');
      measurements.push({
        experimentId: label.match(/^#\d+/)?.[0].slice(1) ?? label,
        experimentLabel: label, timeHours, hydrogenMicromoles, standardDeviationMicromoles,
        sourceRow: r + 1, sourceColumn: c + 1,
      });
    }
  }
  if (!measurements.length) throw new ExperimentalCsvError('CSV contains no measurements.');
  return {
    source, measurements, experimentLabels,
    audit: {
      experimentCount: experimentLabels.length, measurementCount: measurements.length,
      negativeHydrogenMeasurements: measurements.filter(m => m.hydrogenMicromoles < 0).length,
      zeroStandardDeviationMeasurements: measurements.filter(m => m.standardDeviationMicromoles === 0).length,
      maximumTimeHours: Math.max(...measurements.map(m => m.timeHours)),
    },
  };
}
