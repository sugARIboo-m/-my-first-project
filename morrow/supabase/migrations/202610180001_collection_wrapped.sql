-- Collection/Wrapped schema proposal, following the approved Garden direction.
-- Not applied or live-tested. Requires Garden foundation migration.
-- Achievement writes are deliberately NOT granted to authenticated clients:
-- production needs a server-side evaluator using authorized business records.
begin;
create table morrow_eras.achievement_definitions (
 id text primary key, code text not null unique, name jsonb not null,
 description jsonb not null, condition_type text not null,
 condition_config jsonb not null, artwork jsonb not null
);
insert into morrow_eras.achievement_definitions values
('save-1','save-1','{"en":"First little reserve","zh":"第一份小小的储备"}'::jsonb,'{"en":"Reach your first configurable savings threshold.","zh":"达到你设置的第一档储蓄门槛。"}'::jsonb,'saving','{"version":1,"code":"save-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"beginning"}'::jsonb),
('save-2','save-2','{"en":"A little more room","zh":"再多一点余地"}'::jsonb,'{"en":"Reach your second configurable savings threshold.","zh":"达到你设置的第二档储蓄门槛。"}'::jsonb,'saving','{"version":1,"code":"save-2","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"story"}'::jsonb),
('save-3','save-3','{"en":"Tomorrow, taking shape","zh":"明天慢慢成形"}'::jsonb,'{"en":"Reach your third configurable savings threshold.","zh":"达到你设置的第三档储蓄门槛。"}'::jsonb,'saving','{"version":1,"code":"save-3","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"keepsake"}'::jsonb),
('goal-1','goal-1','{"en":"A dream in full bloom","zh":"一个愿望，盛放了"}'::jsonb,'{"en":"Complete one actual savings goal.","zh":"完成一个实际储蓄目标。"}'::jsonb,'saving','{"version":1,"code":"goal-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"keepsake"}'::jsonb),
('goal-3','goal-3','{"en":"Three little victories","zh":"三次小小的胜利"}'::jsonb,'{"en":"Complete three distinct actual savings goals.","zh":"完成三个不同的实际储蓄目标。"}'::jsonb,'saving','{"version":1,"code":"goal-3","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"keepsake"}'::jsonb),
('transaction-1','transaction-1','{"en":"The opening note","zh":"生活的第一笔"}'::jsonb,'{"en":"Record or explicitly import your first actual transaction.","zh":"记录或明确导入第一笔实际账单。"}'::jsonb,'tracking','{"version":1,"code":"transaction-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"beginning"}'::jsonb),
('week-1','week-1','{"en":"Seven days of noticing","zh":"看见生活的一周"}'::jsonb,'{"en":"Have a transaction on each of seven consecutive calendar days. No streak can be lost.","zh":"连续七个日期都有账单；已获纪念不会因中断清零。"}'::jsonb,'tracking','{"version":1,"code":"week-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"story"}'::jsonb),
('review-1','review-1','{"en":"A moment of clarity","zh":"一次清楚的回望"}'::jsonb,'{"en":"Review a month with actual financial records.","zh":"复盘一个有实际财务记录的月份。"}'::jsonb,'tracking','{"version":1,"code":"review-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"beginning"}'::jsonb),
('tracker','tracker','{"en":"A rhythm of your own","zh":"找到自己的节奏"}'::jsonb,'{"en":"Record on 20 distinct days within any 30-day window; no daily streak required.","zh":"在任意 30 天内的 20 个不同日期记录，无需每天连续。"}'::jsonb,'tracking','{"version":1,"code":"tracker","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"story"}'::jsonb),
('budget-1','budget-1','{"en":"An intention, set","zh":"为生活设一个方向"}'::jsonb,'{"en":"Create an actual budget. The demo budget does not qualify.","zh":"建立实际预算，首页演示预算不计入。"}'::jsonb,'awareness','{"version":1,"code":"budget-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"beginning"}'::jsonb),
('budget-review','budget-review','{"en":"Room to reflect","zh":"留一点反思的空间"}'::jsonb,'{"en":"Review an actual saved budget.","zh":"复盘实际保存的预算。"}'::jsonb,'awareness','{"version":1,"code":"budget-review","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"story"}'::jsonb),
('wishlist','wishlist','{"en":"A thoughtful pause","zh":"想清楚，再决定"}'::jsonb,'{"en":"Finish a real wishlist cooldown before reviewing it.","zh":"实际愿望清单冷静期结束后再复盘。"}'::jsonb,'awareness','{"version":1,"code":"wishlist","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"story"}'::jsonb),
('allocation','allocation','{"en":"A place for tomorrow","zh":"给明天安排一个位置"}'::jsonb,'{"en":"Record a positive manual savings allocation. Transfers do not create extra savings.","zh":"记录一次正的储蓄分配；目标间转移不增加储蓄。"}'::jsonb,'awareness','{"version":1,"code":"allocation","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"beginning"}'::jsonb),
('era-1','era-1','{"en":"Your first era","zh":"属于你的第一个 Era"}'::jsonb,'{"en":"Choose a theme for an actual saved goal.","zh":"为实际保存的目标选择主题。"}'::jsonb,'eras','{"version":1,"code":"era-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"beginning"}'::jsonb),
('bloom-1','bloom-1','{"en":"A bloom to remember","zh":"值得记住的盛放"}'::jsonb,'{"en":"Reach Full Bloom with an actual goal.","zh":"实际目标达到盛放阶段。"}'::jsonb,'eras','{"version":1,"code":"bloom-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"keepsake"}'::jsonb),
('eras-4','eras-4','{"en":"Every shade of you","zh":"每一种颜色，都是你"}'::jsonb,'{"en":"Use all four themes on actual saved goals; studio samples do not count.","zh":"在实际目标上使用过四种主题，视觉展台不计入。"}'::jsonb,'eras','{"version":1,"code":"eras-4","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"story"}'::jsonb),
('wrapped-1','wrapped-1','{"en":"Your money era","zh":"你的财务时代"}'::jsonb,'{"en":"Generate a yearly story with actual records or milestones.","zh":"使用实际记录或里程碑生成年度回顾。"}'::jsonb,'eras','{"version":1,"code":"wrapped-1","source":"actual-records-only"}'::jsonb,'{"type":"original-vinyl","rarity":"keepsake"}'::jsonb);
create table morrow_eras.user_achievements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 achievement_id text not null references morrow_eras.achievement_definitions(id),
 unlocked_at timestamptz not null default now(),
 era_theme_id text not null references morrow_eras.era_themes(id),
 metadata jsonb not null default '{}'::jsonb,
 unique(user_id,achievement_id)
);
create table morrow_eras.wrapped_snapshots (
 id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 year integer not null check(year between 1900 and 9999),
 currency text not null check(currency in ('CNY','USD','EUR','GBP')),
 summary_data jsonb not null,
 generated_at timestamptz not null default now(),
 primary key(user_id,id),
 check((summary_data->>'year')::integer=year),
 check(summary_data->>'currency'=currency)
);
create table morrow_eras.era_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 milestone_currency text not null default 'CNY' check(milestone_currency in ('CNY','USD','EUR','GBP')),
 thresholds bigint[] not null default array[10000,50000,100000]::bigint[],
 reduced_motion boolean not null default false,
 check(array_length(thresholds,1)=3 and thresholds[1]>0 and thresholds[2]>thresholds[1] and thresholds[3]>thresholds[2] and thresholds[3]<=9007199254740991)
);
create table morrow_eras.financial_reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('monthly','budget')),
 period text not null check(period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 reviewed_at timestamptz not null default now(),
 unique(user_id,kind,period)
);
alter table morrow_eras.achievement_definitions enable row level security;
alter table morrow_eras.user_achievements enable row level security;
alter table morrow_eras.wrapped_snapshots enable row level security;
alter table morrow_eras.era_preferences enable row level security;
alter table morrow_eras.financial_reviews enable row level security;
create policy definitions_read on morrow_eras.achievement_definitions for select to authenticated using(true);
create policy achievements_read on morrow_eras.user_achievements for select to authenticated using(user_id=(select auth.uid()));
create policy wrapped_read on morrow_eras.wrapped_snapshots for select to authenticated using(user_id=(select auth.uid()));
create policy wrapped_insert on morrow_eras.wrapped_snapshots for insert to authenticated with check(user_id=(select auth.uid()));
create policy wrapped_delete on morrow_eras.wrapped_snapshots for delete to authenticated using(user_id=(select auth.uid()));
create policy preferences_owner on morrow_eras.era_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy reviews_owner on morrow_eras.financial_reviews for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select on morrow_eras.achievement_definitions,morrow_eras.user_achievements to authenticated;
grant select,insert,delete on morrow_eras.wrapped_snapshots to authenticated;
grant select,insert,update,delete on morrow_eras.era_preferences,morrow_eras.financial_reviews to authenticated;
revoke all on morrow_eras.achievement_definitions,morrow_eras.user_achievements,morrow_eras.wrapped_snapshots,morrow_eras.era_preferences,morrow_eras.financial_reviews from anon;
commit;
