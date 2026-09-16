begin;

create function public.touch_conversation_from_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = greatest(updated_at, new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
after insert or update on public.messages
for each row execute function public.touch_conversation_from_message();

revoke all on function public.touch_conversation_from_message()
  from public, anon, authenticated;
grant execute on function public.touch_conversation_from_message()
  to service_role;

comment on function public.touch_conversation_from_message() is
  'Keeps recent-work ordering aligned with persisted message activity.';

commit;
