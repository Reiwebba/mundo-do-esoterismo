-- Execute este ficheiro no Supabase > SQL Editor > New query.
-- Depois de criar a tua conta de cliente, promove o teu utilizador a admin
-- executando a instrução indicada no fim deste ficheiro, substituindo o email.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  type text not null check (type in ('Ebook','Curso','Vídeo')),
  price numeric(12,2) not null check (price > 0),
  currency text not null default 'USD',
  file_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  total numeric(12,2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price > 0)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.create_order(items_json jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_order_id uuid;
  computed_total numeric(12,2) := 0;
  item jsonb;
  product_row public.products%rowtype;
  item_qty integer;
  order_currency text;
begin
  if auth.uid() is null then raise exception 'Tens de iniciar sessão.'; end if;
  if jsonb_typeof(items_json) <> 'array' or jsonb_array_length(items_json) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  for item in select * from jsonb_array_elements(items_json) loop
    item_qty := (item->>'quantity')::integer;
    if item_qty < 1 or item_qty > 20 then raise exception 'Quantidade inválida.'; end if;
    select * into product_row from public.products
      where id = (item->>'product_id')::uuid and is_active = true;
    if not found then raise exception 'Produto indisponível.'; end if;
    if order_currency is null then order_currency := product_row.currency;
    elsif order_currency <> product_row.currency then raise exception 'Não mistures moedas diferentes na mesma encomenda.'; end if;
    computed_total := computed_total + product_row.price * item_qty;
  end loop;

  insert into public.orders(user_id,total,currency)
  values(auth.uid(),computed_total,coalesce(order_currency,'USD'))
  returning id into new_order_id;

  for item in select * from jsonb_array_elements(items_json) loop
    item_qty := (item->>'quantity')::integer;
    select * into product_row from public.products where id = (item->>'product_id')::uuid and is_active = true;
    insert into public.order_items(order_id,product_id,quantity,unit_price)
    values(new_order_id,product_row.id,item_qty,product_row.price);
  end loop;
  return new_order_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Profiles read own or admin" on public.profiles;
create policy "Profiles read own or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products for select
using (is_active = true or public.is_admin());
drop policy if exists "Admins insert products" on public.products;
create policy "Admins insert products" on public.products for insert to authenticated
with check (public.is_admin());
drop policy if exists "Admins update products" on public.products;
create policy "Admins update products" on public.products for update to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete products" on public.products;
create policy "Admins delete products" on public.products for delete to authenticated
using (public.is_admin());

drop policy if exists "Users read own orders or admin" on public.orders;
create policy "Users read own orders or admin" on public.orders for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users read own order items or admin" on public.order_items;
create policy "Users read own order items or admin" on public.order_items for select to authenticated
using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

grant execute on function public.create_order(jsonb) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 1) Regista primeiro a tua própria conta pela loja.
-- 2) No SQL Editor executa (substitui pelo email usado no registo):
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'TEU_EMAIL_AQUI');

-- Armazenamento privado:
-- Cria manualmente um bucket chamado "digital-products" e deixa-o PRIVATE.
-- Não coloques links públicos dos ebooks. A configuração de downloads protegidos
-- e URLs temporários deve ser concluída antes de vender ficheiros reais.
