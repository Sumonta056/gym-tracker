export function reloadPage(): void {
  window.location.reload()
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
