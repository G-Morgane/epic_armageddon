export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const body = await readBody(event)

  const { email, role } = body

  if (!email || !role) {
    throw createError({ statusCode: 400, message: 'Email et rôle requis' })
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
