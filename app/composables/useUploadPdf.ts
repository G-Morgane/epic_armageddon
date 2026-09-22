export function useUploadPdf() {
  async function uploadPdf(file: File, path: string): Promise<string> {
    // Get presigned URL from server
    const { uploadUrl, publicUrl } = await $fetch<{ uploadUrl: string; publicUrl: string }>('/api/upload-pdf-url', {
      method: 'POST',
      body: { path, contentType: 'application/pdf' },
    })

    // Upload directly to R2
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: file,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    return publicUrl
  }

  /** Même chemin de téléversement, pour une image (illustration de couverture d'un codex). */
  async function uploadImage(file: File, path: string): Promise<string> {
    const { uploadUrl, publicUrl } = await $fetch<{ uploadUrl: string; publicUrl: string }>('/api/upload-pdf-url', {
      method: 'POST',
      body: { path, contentType: file.type || 'image/jpeg' },
    })

    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file })
    if (!response.ok) throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    return publicUrl
  }

  return { uploadPdf, uploadImage }
}
