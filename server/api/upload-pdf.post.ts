export default defineEventHandler(async (event) => {
  await exigerAdmin(event)

  // Lire le formulaire multipart
  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, message: 'Aucun fichier envoyé' })
  }

  const fileField = formData.find(f => f.name === 'file')
  const pathField = formData.find(f => f.name === 'path')

  if (!fileField?.data || !pathField?.data) {
    throw createError({ statusCode: 400, message: 'Fichier et chemin requis' })
  }

  const filePath = pathField.data.toString()
  const fileBuffer = fileField.data

  const publicUrl = await uploadToR2(filePath, fileBuffer, 'application/pdf')

  return { url: publicUrl }
})
