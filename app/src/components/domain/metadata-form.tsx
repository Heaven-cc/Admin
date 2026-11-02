"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
export interface MetadataField { key: string; label: string; type?: "number" | "date"; options?: { value: string; label: string }[]; value?: string; minLength?: number; maxLength?: number; pattern?: string }
export function MetadataForm({ title, description, endpoint, fields, label = title }: { title: string; description: string; endpoint: string; fields: MetadataField[]; label?: string }) {
 const router = useRouter(); const [open, setOpen] = React.useState(false), [loading, setLoading] = React.useState(false), [error, setError] = React.useState<string | null>(null);
 async function submit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault(); setLoading(true); setError(null);
  const values = new FormData(e.currentTarget), body: Record<string, string | number> = {};
  for (const f of fields) body[f.key] = f.type === "number" ? Number(values.get(f.key)) : String(values.get(f.key) ?? "").trim();
  try { const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Request": "1" }, body: JSON.stringify(body) }); const result = await res.json(); if (!res.ok || !result.data?.id) throw new Error(result.error?.message ?? "Save was not completed."); setOpen(false); router.refresh(); }
  catch(e) { setError(e instanceof Error ? e.message : "Save failed."); } finally { setLoading(false); }
 }
 return <><Button variant="outline" size="sm" onClick={()=>{setError(null);setOpen(true);}}>{label}</Button><Dialog open={open} onOpenChange={o=>{if(!loading)setOpen(o);}}><DialogContent><DialogTitle>{title}</DialogTitle><DialogDescription className="mb-4 mt-2">{description}</DialogDescription><form onSubmit={submit} className="space-y-3">
 {fields.map(f=><Field key={f.key} label={f.label}>{f.options ? <Select required className="w-full" name={f.key} defaultValue={f.value}>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select> : <Input required name={f.key} type={f.type ?? "text"} defaultValue={f.value} min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? 1 : undefined} minLength={f.minLength} maxLength={f.maxLength} pattern={f.pattern} />}</Field>)}
 {error?<p role="alert" className="text-xs text-danger">{error}</p>:null}<Button type="submit" className="w-full" loading={loading}>Save draft</Button>
 </form></DialogContent></Dialog></>;
}
