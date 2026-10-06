export function csvImportEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CSV_IMPORT === '1'
}

export function crashTestEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CRASH_TEST === '1'
}
