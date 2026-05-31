-- ============================================================
-- ProcureFlow — Schema SQL para Supabase
-- Copia e executa no Supabase: SQL Editor → New Query → Run
-- ============================================================

-- Extensão para UUID
create extension if not exists "uuid-ossp";

-- ── EMPREGADOS ────────────────────────────────────────────────
create table if not exists employees (
  id          uuid primary key default uuid_generate_v4(),
  emp_code    text unique not null,       -- ex: EMP-042
  full_name   text not null,
  email       text unique not null,
  role        text default 'employee',   -- 'admin' | 'manager' | 'employee'
  created_at  timestamptz default now()
);

-- ── FORNECEDORES ──────────────────────────────────────────────
create table if not exists suppliers (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  nif           text,
  contact_name  text,
  email         text,
  phone         text,
  address       text,
  category      text,                    -- ex: 'Cabos', 'Material eléctrico'
  payment_terms text default '30 dias',
  notes         text,
  active        boolean default true,
  created_at    timestamptz default now()
);

-- ── ARTIGOS / STOCK ───────────────────────────────────────────
create table if not exists items (
  id             uuid primary key default uuid_generate_v4(),
  reference      text unique not null,
  description    text not null,
  unit           text default 'un.',
  stock_current  numeric default 0,
  stock_min      numeric default 0,
  stock_ideal    numeric default 0,
  warehouse      text default 'Armazém A',
  category       text,
  created_at     timestamptz default now()
);

-- ── REQUISIÇÕES ───────────────────────────────────────────────
create table if not exists requisitions (
  id              uuid primary key default uuid_generate_v4(),
  ref_number      text unique not null,  -- ex: REQ-081
  created_by      uuid references employees(id),
  item_id         uuid references items(id),
  description     text not null,
  quantity        numeric not null,
  unit            text default 'un.',
  priority        text default 'Média',  -- 'Alta' | 'Média' | 'Baixa'
  needed_by       date,
  min_quotes      integer default 2,
  notes           text,
  status          text default 'Pendente',
  -- 'Pendente' | 'Em cotação' | 'Aprovado' | 'Encomendado' | 'Entregue' | 'Cancelado'
  created_at      timestamptz default now()
);

-- ── COTAÇÕES ─────────────────────────────────────────────────
create table if not exists quotations (
  id               uuid primary key default uuid_generate_v4(),
  requisition_id   uuid references requisitions(id) on delete cascade,
  supplier_id      uuid references suppliers(id),
  created_by       uuid references employees(id),
  supplier_ref     text,
  unit_price       numeric not null,
  discount_pct     numeric default 0,
  final_price      numeric generated always as (unit_price * (1 - discount_pct/100)) stored,
  delivery_days    integer,
  valid_until      date,
  payment_terms    text,
  notes            text,
  selected         boolean default false,
  created_at       timestamptz default now()
);

-- ── ENCOMENDAS ────────────────────────────────────────────────
create table if not exists orders (
  id              uuid primary key default uuid_generate_v4(),
  ref_number      text unique not null,  -- ex: ENC-044
  requisition_id  uuid references requisitions(id),
  quotation_id    uuid references quotations(id),
  supplier_id     uuid references suppliers(id),
  approved_by     uuid references employees(id),
  quantity        numeric not null,
  total_amount    numeric,
  status          text default 'Confirmado',
  -- 'Confirmado' | 'Em trânsito' | 'Entregue' | 'Cancelado'
  expected_date   date,
  delivered_date  date,
  tracking_ref    text,
  notes           text,
  created_at      timestamptz default now()
);

-- ── PAGAMENTOS ────────────────────────────────────────────────
create table if not exists payments (
  id             uuid primary key default uuid_generate_v4(),
  order_id       uuid references orders(id),
  invoice_ref    text,
  amount         numeric not null,
  due_date       date,
  paid_date      date,
  status         text default 'Pendente',  -- 'Pendente' | 'Pago' | 'Em atraso'
  notes          text,
  created_at     timestamptz default now()
);

-- ── TRANSPORTADORES ───────────────────────────────────────────
create table if not exists carriers (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  vehicle_type text,                 -- 'Furgão' | 'Carrinha' | 'Camioneta'
  plate        text,
  phone        text,
  max_load_kg  numeric,
  routes       text,                 -- ex: 'Lisboa / Setúbal'
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ── DISPONIBILIDADE DE TRANSPORTE ────────────────────────────
create table if not exists carrier_schedules (
  id           uuid primary key default uuid_generate_v4(),
  carrier_id   uuid references carriers(id) on delete cascade,
  date         date not null,
  depart_time  time,
  return_time  time,
  current_load numeric default 0,
  status       text default 'Disponível',  -- 'Disponível' | 'Ocupado'
  notes        text
);

-- ── AVALIAÇÕES DE FORNECEDORES ───────────────────────────────
create table if not exists supplier_reviews (
  id            uuid primary key default uuid_generate_v4(),
  supplier_id   uuid references suppliers(id) on delete cascade,
  order_id      uuid references orders(id),
  reviewed_by   uuid references employees(id),
  quality       integer check (quality between 1 and 5),
  punctuality   integer check (punctuality between 1 and 5),
  price_value   integer check (price_value between 1 and 5),
  communication integer check (communication between 1 and 5),
  notes         text,
  created_at    timestamptz default now()
);

-- ── VIEWS ÚTEIS ──────────────────────────────────────────────

-- Stock abaixo do mínimo
create or replace view stock_alerts as
  select
    id, reference, description, unit,
    stock_current, stock_min, warehouse,
    round((stock_current::numeric / nullif(stock_min,0)) * 100) as pct_of_min,
    case
      when stock_current = 0            then 'Rotura'
      when stock_current < stock_min * 0.3 then 'Crítico'
      else 'Baixo'
    end as alert_level
  from items
  where stock_current < stock_min
  order by pct_of_min asc;

-- Médias de avaliação por fornecedor
create or replace view supplier_scores as
  select
    s.id, s.name, s.category,
    count(r.id)                        as total_reviews,
    round(avg(r.quality)::numeric, 1)       as avg_quality,
    round(avg(r.punctuality)::numeric, 1)   as avg_punctuality,
    round(avg(r.price_value)::numeric, 1)   as avg_price,
    round(avg(r.communication)::numeric, 1) as avg_communication,
    round(avg((r.quality + r.punctuality + r.price_value + r.communication)::numeric / 4), 1) as avg_total
  from suppliers s
  left join supplier_reviews r on r.supplier_id = s.id
  group by s.id, s.name, s.category;

-- ── ROW LEVEL SECURITY (básico) ──────────────────────────────
alter table employees        enable row level security;
alter table requisitions     enable row level security;
alter table quotations       enable row level security;
alter table orders           enable row level security;
alter table payments         enable row level security;
alter table suppliers        enable row level security;
alter table items            enable row level security;
alter table carriers         enable row level security;
alter table carrier_schedules enable row level security;
alter table supplier_reviews enable row level security;

-- Política simples: utilizadores autenticados veem tudo
-- (podes restringir por role mais tarde)
create policy "Authenticated users have full access" on employees        for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on requisitions     for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on quotations       for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on orders           for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on payments         for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on suppliers        for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on items            for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on carriers         for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on carrier_schedules for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on supplier_reviews for all using (auth.role() = 'authenticated');

-- ── DADOS DE EXEMPLO ─────────────────────────────────────────
insert into suppliers (name, nif, contact_name, email, phone, category, payment_terms) values
  ('TechCables Portugal', '501234567', 'Carlos Matos', 'cmatos@techcables.pt', '+351 210 001 001', 'Cabos', '60 dias'),
  ('Schneider Direct', '502345678', 'Ana Ferreira', 'aferreira@schneider.pt', '+351 210 002 002', 'Material eléctrico', '30 dias'),
  ('ElectroZone', '503456789', 'Paulo Ramos', 'pramos@electrozone.pt', '+351 210 003 003', 'Material eléctrico', '30 dias'),
  ('Electro-Sul Lda', '504567890', 'Miguel Costa', 'mcosta@electrosul.pt', '+351 210 004 004', 'Quadros', '45 dias');

insert into items (reference, description, unit, stock_current, stock_min, stock_ideal, warehouse, category) values
  ('FUS-63A-CIL', 'Fusíveis 63A cilíndrico 22×58', 'un.', 0, 50, 150, 'Armazém A', 'Protecção'),
  ('CAB-H07V-25-AV', 'Cabo H07V-K 2,5mm² amarelo/verde', 'm', 12, 200, 600, 'Armazém B', 'Cabos'),
  ('ABR-MET-16', 'Abraçadeiras metálicas 16mm (cx 100un)', 'cx', 0, 5, 15, 'Armazém A', 'Fixação'),
  ('DIS-MAG-16A-1P', 'Disjuntores magnetotérmicos 16A 1P', 'un.', 8, 30, 80, 'Armazém A', 'Protecção'),
  ('TUB-VD-20', 'Tubo VD rígido 20mm (vara 3m)', 'vara', 11, 40, 120, 'Armazém B', 'Condutas'),
  ('CX-IP55-100', 'Caixa derivação IP55 100×100mm', 'un.', 6, 20, 60, 'Armazém A', 'Caixas'),
  ('FIT-ISO-19', 'Fita isoladora 19mm preta rolo 20m', 'rolo', 7, 24, 72, 'Armazém C', 'Consumíveis'),
  ('CAB-UTP-CAT6', 'Cabo UTP Cat6 (rolo 500m)', 'rolo', 2, 3, 8, 'Armazém B', 'Cabos');

insert into carriers (name, vehicle_type, plate, phone, max_load_kg, routes) values
  ('António Ferreira', 'Furgão', '12-AB-34', '+351 912 345 678', 800, 'Lisboa / Setúbal'),
  ('Luís Mendes', 'Carrinha', '45-CD-67', '+351 923 456 789', 500, 'Lisboa / Sintra / Cascais'),
  ('Pedro Costa', 'Camioneta', '78-EF-90', '+351 934 567 890', 2000, 'Almada / Barreiro'),
  ('Rui Oliveira', 'Furgão', '23-GH-45', '+351 945 678 901', 700, 'Lisboa / Odivelas / Loures');
