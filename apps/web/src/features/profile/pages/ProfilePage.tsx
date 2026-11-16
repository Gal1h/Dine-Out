import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Sparkles, Trash2 } from "lucide-react";
import { changePasswordSchema, updateProfileSchema } from "@dineout/shared";
import { useAuth } from "../../auth/use-auth";
import { Button } from "../../../components/ui/button";
import { Badge, RoleBadge } from "../../../components/ui/badge";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "../../../components/ui/card";
import { Field, FormError, Input } from "../../../components/ui/form";
import { Dialog } from "../../../components/ui/dialog";
import { api, errorMessage } from "../../../lib/api";
import { toast } from "../../../lib/store";
import { initials } from "../../../lib/utils";

export function ProfilePage() {
  const { me, isAdminAccount, role, refresh } = useAuth();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(me?.user.displayName ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [geminiKey, setGeminiKey] = useState("");
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const profileMutation = useMutation({
    mutationFn: (value: string) => api.patch("/profile", { displayName: value }),
    onSuccess: async () => {
      toast("Nama diperbarui", { variant: "success" });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await refresh();
    },
    onError: (err) => setProfileError(errorMessage(err)),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      api.patch("/auth/password", values),
    onSuccess: async () => {
      toast("Password diperbarui", { description: "Sesi lain sudah dikeluarkan.", variant: "success" });
      setPasswordForm({ currentPassword: "", newPassword: "" });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => setPasswordError(errorMessage(err)),
  });

  const geminiMutation = useMutation({
    mutationFn: (apiKey: string) => api.put("/profile/gemini-key", { apiKey }),
    onSuccess: async () => {
      toast("API key Gemini disimpan", { variant: "success" });
      setGeminiKey("");
      await refresh();
    },
    onError: (err) => setGeminiError(errorMessage(err)),
  });

  const deleteGeminiMutation = useMutation({
    mutationFn: () => api.del("/profile/gemini-key"),
    onSuccess: async () => {
      toast("API key Gemini dihapus", { variant: "success" });
      setConfirmDelete(false);
      await refresh();
    },
    onError: (err) => setGeminiError(errorMessage(err)),
  });

  const saveProfile = () => {
    setProfileError(null);
    const parsed = updateProfileSchema.safeParse({ displayName });
    if (!parsed.success) {
      setProfileError(parsed.error.issues[0]?.message ?? "Nama tidak valid");
      return;
    }
    profileMutation.mutate(parsed.data.displayName);
  };

  const savePassword = () => {
    setPasswordError(null);
    const parsed = changePasswordSchema.safeParse(passwordForm);
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? "Password tidak valid");
      return;
    }
    passwordMutation.mutate(parsed.data);
  };

  if (!me) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Profil & pengaturan</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Kelola nama, password, dan API key Gemini (khusus admin).
        </p>
      </div>

      <Card>
        <CardBody className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
            {initials(me.user.displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-semibold">{me.user.displayName}</p>
              {role ? <RoleBadge role={role} /> : null}
            </div>
            <p className="truncate text-2xs text-muted-foreground">
              {me.user.email ?? `member · ${me.group?.name ?? "grup"}`}
            </p>
          </div>
          <Badge variant="outline">{isAdminAccount ? "Admin" : "Member"}</Badge>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nama tampilan</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Nama">
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </Field>
          <FormError>{profileError}</FormError>
        </CardBody>
        <CardFooter className="justify-end">
          <Button size="sm" onClick={saveProfile} loading={profileMutation.isPending}>
            Simpan nama
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ganti password</CardTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Semua sesi lain akan keluar setelah password diganti.
          </p>
        </CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Password saat ini">
            <Input
              type="password"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
            />
          </Field>
          <Field label="Password baru" hint="Minimal 8 karakter">
            <Input
              type="password"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <FormError>{passwordError}</FormError>
          </div>
        </CardBody>
        <CardFooter className="justify-end">
          <Button size="sm" onClick={savePassword} loading={passwordMutation.isPending}>
            Perbarui password
          </Button>
        </CardFooter>
      </Card>

      {isAdminAccount ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Gemini API key
            </CardTitle>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Dipakai untuk sortir pesanan dengan AI. Key disimpan terenkripsi (AES-256-GCM) di
              server dan tidak pernah ditampilkan lagi.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2 text-[13px]">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                {me.hasGeminiKey ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-medium text-success">Tersimpan</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Belum ada key</span>
                )}
              </div>
              {me.hasGeminiKey ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus key
                </Button>
              ) : null}
            </div>

            <Field label={me.hasGeminiKey ? "Ganti API key" : "Tambah API key"}>
              <Input
                type="password"
                placeholder="AIza…"
                autoComplete="off"
                value={geminiKey}
                onChange={(event) => setGeminiKey(event.target.value)}
              />
            </Field>
            <FormError>{geminiError}</FormError>
            <p className="text-2xs text-muted-foreground">
              Buat key di Google AI Studio. Key hanya dikirim ke server saat disimpan.
            </p>
          </CardBody>
          <CardFooter className="justify-end">
            <Button
              size="sm"
              disabled={geminiKey.trim().length < 20}
              loading={geminiMutation.isPending}
              onClick={() => {
                setGeminiError(null);
                geminiMutation.mutate(geminiKey.trim());
              }}
            >
              Simpan key
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Hapus Gemini API key?"
        description="Sortir dengan AI tidak bisa dipakai sampai key baru diisi."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            loading={deleteGeminiMutation.isPending}
            onClick={() => deleteGeminiMutation.mutate()}
          >
            Hapus key
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
