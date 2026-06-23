alter table public.mcp_call_ledger
  drop constraint if exists mcp_call_ledger_billable_calls_check;

alter table public.mcp_call_ledger
  add constraint mcp_call_ledger_billable_calls_nonnegative
  check (billable_calls >= 0);

comment on column public.mcp_call_ledger.billable_calls is
  'Number of calls charged for settlement. Trial executions are recorded with 0 and must not count as creator earnings or hirer spend.';
