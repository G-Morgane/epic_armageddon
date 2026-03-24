export default defineEventHandler(async (event) => {
  // Vérifier l'authentification via le token Supabase
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const supabase = useSupabaseServer()
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  // Vérifier le rôle admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    throw createError({ statusCode: 403, message: 'Accès interdit' })
  }

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
