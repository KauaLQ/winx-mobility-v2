import { createClient } from '@supabase/supabase-js'

// Instância única: guarda a sessão no localStorage, renova o token sozinho e lê o retorno do OAuth na URL.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)