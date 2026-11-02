"use client";
import { Button } from "@/components/ui/button";
export default function DashboardError({reset}:{error:Error & {digest?:string};reset:()=>void}){return <div role="alert" className="rounded-lg border border-border bg-surface p-6"><h2 className="font-semibold">Admin data is temporarily unavailable</h2><p className="my-3 text-sm text-muted-foreground">The request could not be completed. Check your connection and administrator access, then retry.</p><Button onClick={reset}>Retry</Button><a href="/login" className="ml-4 text-sm text-brand">Sign in again</a></div>;}
