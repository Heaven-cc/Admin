create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs(actor_user_id);
create index if not exists model_deployments_model_idx on public.model_deployments(model_id);
create index if not exists model_evaluations_model_idx on public.model_evaluations(model_id);
create index if not exists model_evaluations_dataset_idx on public.model_evaluations(dataset_version_id);
create index if not exists training_assets_sample_idx on public.training_assets(sample_id);
create index if not exists training_runs_dataset_idx on public.training_runs(dataset_version_id);
