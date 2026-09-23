export function csvImportEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CSV_IMPORT === '1'
}
