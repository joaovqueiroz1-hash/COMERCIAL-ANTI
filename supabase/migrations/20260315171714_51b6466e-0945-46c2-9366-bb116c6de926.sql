
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'vendedor');
CREATE TYPE public.pipeline_status AS ENUM (
  'novo_lead', 'tentativa_contato', 'contato_realizado', 
  'reuniao_agendada', 'reuniao_realizada', 'followup', 
  'negociacao', 'fechado', 'perdido'
);
CREATE TYPE public.prioridade_type AS ENUM ('alta', 'media', 'baixa');
CREATE TYPE public.tipo_interacao AS ENUM ('whatsapp', 'ligacao', 'reuniao', 'email');
CREATE TYPE public.interesse_type AS ENUM ('baixo', 'medio', 'alto');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  perfil app_role NOT NULL DEFAULT 'vendedor',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Security definer to get user profile type
CREATE OR REPLACE FUNCTION public.get_user_perfil(_user_id UUID)
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT perfil FROM public.profiles WHERE id = _user_id
$$;

-- Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome_completo TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  cidade TEXT,
  estado TEXT,
  eh_empresario BOOLEAN DEFAULT false,
  nome_empresa TEXT,
  instagram_empresa TEXT,
  quantidade_funcionarios INTEGER DEFAULT 0,
  maior_dor TEXT,
  faturamento_anual NUMERIC DEFAULT 0,
  capacidade_investimento BOOLEAN DEFAULT false,
  observacoes_iniciais TEXT,
  status_pipeline pipeline_status NOT NULL DEFAULT 'novo_lead',
  gestor_id UUID REFERENCES public.profiles(id),
  vendedor_id UUID REFERENCES public.profiles(id),
  prioridade prioridade_type NOT NULL DEFAULT 'media',
  fit_mentoria INTEGER DEFAULT 0 CHECK (fit_mentoria >= 0 AND fit_mentoria <= 5),
  probabilidade_fechamento INTEGER DEFAULT 0 CHECK (probabilidade_fechamento >= 0 AND probabilidade_fechamento <= 100),
  ultimo_contato TIMESTAMPTZ,
  proximo_followup TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  observacoes_estrategicas TEXT,
  origem TEXT
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Interações table
CREATE TABLE public.interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo tipo_interacao NOT NULL,
  realizado_por UUID REFERENCES public.profiles(id),
  resumo TEXT,
  objecoes TEXT,
  interesse_demonstrado interesse_type DEFAULT 'medio',
  proximo_passo TEXT,
  data_proximo_followup TIMESTAMPTZ
);
ALTER TABLE public.interacoes ENABLE ROW LEVEL SECURITY;

-- Próximas ações table
CREATE TABLE public.proximas_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_hora TIMESTAMPTZ NOT NULL,
  tipo TEXT,
  responsavel_id UUID REFERENCES public.profiles(id),
  concluida BOOLEAN DEFAULT false
);
ALTER TABLE public.proximas_acoes ENABLE ROW LEVEL SECURITY;

-- Pipeline logs table
CREATE TABLE public.pipeline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status_anterior pipeline_status,
  status_novo pipeline_status NOT NULL,
  alterado_por UUID REFERENCES public.profiles(id),
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_logs ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, perfil)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email, COALESCE((NEW.raw_user_meta_data->>'perfil')::app_role, 'vendedor'));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'perfil')::app_role, 'vendedor'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Authenticated can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "View leads" ON public.leads FOR SELECT TO authenticated USING (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR vendedor_id = auth.uid());
CREATE POLICY "Insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor', 'vendedor'));
CREATE POLICY "Update leads" ON public.leads FOR UPDATE TO authenticated USING (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR vendedor_id = auth.uid());
CREATE POLICY "Delete leads" ON public.leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View interacoes" ON public.interacoes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = interacoes.lead_id AND (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR leads.vendedor_id = auth.uid())));
CREATE POLICY "Insert interacoes" ON public.interacoes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = interacoes.lead_id AND (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR leads.vendedor_id = auth.uid())));

CREATE POLICY "View proximas_acoes" ON public.proximas_acoes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = proximas_acoes.lead_id AND (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR leads.vendedor_id = auth.uid())));
CREATE POLICY "Insert proximas_acoes" ON public.proximas_acoes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = proximas_acoes.lead_id AND (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR leads.vendedor_id = auth.uid())));
CREATE POLICY "Update proximas_acoes" ON public.proximas_acoes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = proximas_acoes.lead_id AND (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR leads.vendedor_id = auth.uid())));

CREATE POLICY "View pipeline_logs" ON public.pipeline_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = pipeline_logs.lead_id AND (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR leads.vendedor_id = auth.uid())));
CREATE POLICY "Insert pipeline_logs" ON public.pipeline_logs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = pipeline_logs.lead_id AND (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor') OR leads.vendedor_id = auth.uid())));

-- Indexes
CREATE INDEX idx_leads_status ON public.leads(status_pipeline);
CREATE INDEX idx_leads_vendedor ON public.leads(vendedor_id);
CREATE INDEX idx_leads_gestor ON public.leads(gestor_id);
CREATE INDEX idx_interacoes_lead ON public.interacoes(lead_id);
CREATE INDEX idx_proximas_acoes_lead ON public.proximas_acoes(lead_id);
CREATE INDEX idx_pipeline_logs_lead ON public.pipeline_logs(lead_id);
