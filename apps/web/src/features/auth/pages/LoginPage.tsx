import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loginAdminSchema, loginMemberSchema, type LoginAdminInput, type LoginMemberInput } from "@dineout/shared";
import { ArrowRight } from "lucide-react";
import { api, errorMessage } from "../../../lib/api";
import { useAuth } from "../use-auth";
import { Button } from "../../../components/ui/button";
import { Field, FormError, Input, Select } from "../../../components/ui/form";
import { cn } from "../../../lib/utils";

type Mode = "admin" | "member";

export function LoginPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("admin");
  const [error, setError] = useState<string | null>(null);

  const groups = useQuery({
    queryKey: ["groups", "public"],
    queryFn: () => api.get<{ groups: Array<{ id: string; name: string }> }>("/groups/public"),
    staleTime: 60_000,
  });

  const adminForm = useForm<LoginAdminInput>({
    resolver: zodResolver(loginAdminSchema),
    defaultValues: { email: "", password: "" },
  });
  const memberForm = useForm<LoginMemberInput>({
    resolver: zodResolver(loginMemberSchema),
    defaultValues: { groupId: "", username: "", password: "" },
  });

  useEffect(() => {
    if (!memberForm.getValues("groupId") && groups.data?.groups[0]) {
      memberForm.setValue("groupId", groups.data.groups[0].id);
    }
  }, [groups.data, memberForm]);

  const loginMutation = useMutation({
    mutationFn: (payload: { mode: Mode; data: LoginAdminInput | LoginMemberInput }) =>
      api.post(`/auth/${payload.mode}/login`, payload.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/", { replace: true });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (me) return <Navigate to="/" replace />;

  const busy = loginMutation.isPending;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col lg:flex-row">
      <div className="relative flex flex-col justify-between overflow-hidden bg-foreground px-6 py-8 text-background sm:px-10 lg:w-[44%] lg:py-12">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M7 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" strokeLinecap="round" />
              <path d="M7 7h4M9 13v8" strokeLinecap="round" />
              <path d="M17 3c-1.6 1.2-2.4 3-2.4 5.4 0 1.6.8 2.6 2.4 2.6s2.4-1 2.4-2.6C19.4 6 18.6 4.2 17 3Z" />
              <path d="M17 11v10" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">DineOut</span>
        </div>

        <div className="mt-10 max-w-sm lg:mt-0">
          <p className="text-2xs uppercase tracking-[0.16em] text-background/50">Pesan makan bareng</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
            Satu tempat untuk voting tempat makan, isi pesanan, dan tagihan.
          </h1>
          <p className="mt-4 text-[13px] leading-relaxed text-background/60">
            Admin membuat grup dan akun anggota. Anggota memilih menu sebelum batas waktu, lalu
            tagihan dihitung otomatis.
          </p>
        </div>

        <div className="mt-10 hidden gap-6 text-2xs uppercase tracking-wider text-background/40 lg:flex">
          <span>Voting tempat</span>
          <span>Form pesanan</span>
          <span>Rekap</span>
          <span>Tagihan</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight">Masuk</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Pilih jenis akun Anda.
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-md border border-border bg-muted/60 p-1">
            {(["admin", "member"] as Mode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError(null);
                }}
                className={cn(
                  "rounded px-3 py-1.5 text-[13px] font-medium transition-colors",
                  mode === item
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item === "admin" ? "Admin" : "Member"}
              </button>
            ))}
          </div>

          {mode === "admin" ? (
            <form
              className="space-y-3.5"
              onSubmit={adminForm.handleSubmit((data) => {
                setError(null);
                loginMutation.mutate({ mode: "admin", data });
              })}
            >
              <Field label="Email" error={adminForm.formState.errors.email?.message}>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  {...adminForm.register("email")}
                />
              </Field>
              <Field label="Password" error={adminForm.formState.errors.password?.message}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  {...adminForm.register("password")}
                />
              </Field>
              <FormError>{error}</FormError>
              <Button type="submit" fullWidth size="lg" loading={busy}>
                Masuk sebagai admin <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-[13px] text-muted-foreground">
                Belum punya akun?{" "}
                <Link to="/register" className="font-medium text-primary hover:underline">
                  Daftar admin
                </Link>
              </p>
            </form>
          ) : (
            <form
              className="space-y-3.5"
              onSubmit={memberForm.handleSubmit((data) => {
                setError(null);
                loginMutation.mutate({ mode: "member", data });
              })}
            >
              <Field label="Grup" error={memberForm.formState.errors.groupId?.message}>
                <Select {...memberForm.register("groupId")} disabled={groups.isLoading}>
                  {groups.isLoading ? <option>Memuat grup…</option> : null}
                  {groups.data?.groups.length === 0 ? <option>Belum ada grup</option> : null}
                  {groups.data?.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Username" error={memberForm.formState.errors.username?.message}>
                <Input autoComplete="username" placeholder="username" {...memberForm.register("username")} />
              </Field>
              <Field label="Password" error={memberForm.formState.errors.password?.message}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  {...memberForm.register("password")}
                />
              </Field>
              <FormError>{error}</FormError>
              <Button type="submit" fullWidth size="lg" loading={busy}>
                Masuk sebagai member <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-[13px] text-muted-foreground">
                Akun member dibuat oleh admin grup.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
