import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { registerAdminSchema } from "@dineout/shared";
import { api, errorMessage } from "../../../lib/api";
import { useAuth } from "../use-auth";
import { Button } from "../../../components/ui/button";
import { Field, FormError, Input } from "../../../components/ui/form";

const formSchema = registerAdminSchema
  .extend({ confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi") })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak sama",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

export function RegisterPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/auth/admin/register", {
        displayName: values.displayName,
        email: values.email,
        password: values.password,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/", { replace: true });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (me) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link
        to="/login"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke halaman masuk
      </Link>

      <div className="mb-6">
        <p className="text-2xs uppercase tracking-[0.16em] text-primary">DineOut</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Daftar akun admin</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Admin membuat grup, mengelola anggota, dan menyusun tagihan. Setelah mendaftar, buat grup
          pertama Anda.
        </p>
      </div>

      <form
        className="space-y-3.5"
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          mutation.mutate(values);
        })}
      >
        <Field label="Nama tampilan" error={form.formState.errors.displayName?.message}>
          <Input placeholder="Nama Anda" autoComplete="name" {...form.register("displayName")} />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input
            type="email"
            placeholder="nama@email.com"
            autoComplete="email"
            {...form.register("email")}
          />
        </Field>
        <Field
          label="Password"
          hint="Minimal 8 karakter"
          error={form.formState.errors.password?.message}
        >
          <Input
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        </Field>
        <Field label="Ulangi password" error={form.formState.errors.confirmPassword?.message}>
          <Input
            type="password"
            placeholder="Ulangi password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
        </Field>

        <FormError>{error}</FormError>

        <Button type="submit" fullWidth size="lg" loading={mutation.isPending}>
          Buat akun admin
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          Sudah punya akun?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </form>
    </div>
  );
}
