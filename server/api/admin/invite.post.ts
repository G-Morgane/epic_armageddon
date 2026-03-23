export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const body = await readBody(event)

  // Verify the request comes from an authenticated super_admin
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) {
    throw createError({ statusCode: 401, message: 'Non authentifié' })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    throw createError({ statusCode: 401, message: 'Non authentifié' })
  }

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    throw createError({ statusCode: 403, message: 'Accès refusé' })
  }

  const { email, role } = body

  if (!email || !role) {
    throw createError({ statusCode: 400, message: 'Email et rôle requis' })
  }

  if (!['admin', 'super_admin'].includes(role)) {
    throw createError({ statusCode: 400, message: 'Rôle invalide' })
  }

  // Create user with default password "0000"
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      display_name: email.split('@')[0],
      must_change_password: true,
    },
    password: '0000',
  })

  if (error) {
    throw createError({ statusCode: 400, message: error.message })
  }

  // Update role if super_admin
  if (role === 'super_admin' && data.user) {
    await supabase
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', data.user.id)
  }

  return { success: true }
})
