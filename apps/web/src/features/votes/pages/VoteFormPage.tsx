import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, ImagePlus, MapPin, Store, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { mapsUrlSchema, LIMITS } from "@dineout/shared";
import { useVote, useCreateVote, useUpdateVote } from "../queries";
import { useGroup } from "../../groups/queries";
import { Button } from "../../../components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/card";
import { Field, FormError, Input, Textarea } from "../../../components/ui/form";
import { LoadingBlock } from "../../../components/ui/feedback";
import { errorMessage } from "../../../lib/api";
import { fromJakartaInput, toJakartaInput } from "../../../lib/utils";
import { toast } from "../../../lib/store";

const schema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(LIMITS.storeName.min, "Nama toko minimal 2 karakter")
      .max(LIMITS.storeName.max, "Nama toko maksimal 150 karakter"),
    mapsUrl: mapsUrlSchema,
    menuText: z.string().max(LIMITS.menuText, "Teks menu terlalu panjang"),
    voteDeadline: z.string().min(1, "Batas voting wajib diisi"),
    orderDeadline: z.string().min(1, "Batas isi form wajib diisi"),
  })
  .refine((value) => new Date(value.orderDeadline) > new Date(value.voteDeadline), {
    message: "Batas isi form harus setelah batas voting",
    path: ["orderDeadline"],
  });

type Values = z.infer<typeof schema>;

export function VoteFormPage() {
  const { groupId, voteId } = useParams<{ groupId?: string; voteId?: string }>();
  const isEdit = Boolean(voteId);
  const navigate = useNavigate();
  const voteQuery = useVote(voteId);
  const groupQuery = useGroup(groupId);
  const activeGroupId = groupId ?? voteQuery.data?.vote.groupId;

  const createMutation = useCreateVote(activeGroupId ?? "");
  const updateMutation = useUpdateVote(voteId ?? "");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vote = voteQuery.data?.vote;
  const role = groupQuery.data?.group.role ?? voteQuery.data?.role;
  const canManage = role === "admin" || role === "mod";

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      storeName: "",
      mapsUrl: "",
      menuText: "",
      voteDeadline: "",
      orderDeadline: "",
    },
  });

  useEffect(() => {
    if (isEdit && vote) {
      form.reset({
        storeName: vote.storeName,
        mapsUrl: vote.mapsUrl,
        menuText: vote.menuText ?? "",
        voteDeadline: toJakartaInput(vote.voteDeadline),
        orderDeadline: toJakartaInput(vote.orderDeadline),
      });
    }
  }, [isEdit, vote, form]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const existingImage = !removeImage && vote?.menuImageUrl ? vote.menuImageUrl : null;
  const hasMenu = Boolean(form.watch("menuText")?.trim()) || Boolean(imageFile) || Boolean(existingImage);

  const title = useMemo(() => (isEdit ? "Edit voting" : "Buat voting"), [isEdit]);

  if (isEdit && voteQuery.isLoading) return <LoadingBlock label="Memuat voting" />;

  if (role && !canManage) {
    return <FormError>Hanya admin dan mod yang bisa membuat atau mengedit voting.</FormError>;
  }

  if (isEdit && vote && vote.status !== "open") {
    return (
      <div className="space-y-4">
        <Link to={`/votes/${vote.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke voting
        </Link>
        <FormError>Batas voting sudah lewat, voting ini tidak bisa diedit lagi.</FormError>
      </div>
    );
  }

  const onSubmit = (values: Values) => {
    setError(null);
    if (!hasMenu) {
      setError("Isi teks menu atau unggah screenshot menu");
      return;
    }
    if (!activeGroupId) return;

    const payload = {
      storeName: values.storeName,
      mapsUrl: values.mapsUrl,
      menuText: values.menuText,
      voteDeadline: fromJakartaInput(values.voteDeadline),
      orderDeadline: fromJakartaInput(values.orderDeadline),
      menuImage: imageFile,
      removeMenuImage: removeImage,
    };

    if (isEdit && voteId) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          toast("Voting diperbarui", { variant: "success" });
          navigate(`/votes/${voteId}`);
        },
        onError: (err) => setError(errorMessage(err)),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: (data) => {
          toast("Voting dibuat", { variant: "success" });
          navigate(`/votes/${data.vote.id}`);
        },
        onError: (err) => setError(errorMessage(err)),
      });
    }
  };

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <Link
          to={voteId ? `/votes/${voteId}` : `/groups/${activeGroupId}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Anggota memilih setelah batas voting, lalu mengisi pesanan sebelum batas isi form.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" /> Tempat makan
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3.5">
          <Field label="Nama toko" error={form.formState.errors.storeName?.message}>
            <Input placeholder="Contoh: Warung Nasi Ibu Sari" {...form.register("storeName")} />
          </Field>
          <Field
            label="Link Google Maps"
            hint="Buka di aplikasi Maps"
            error={form.formState.errors.mapsUrl?.message}
          >
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="https://maps.app.goo.gl/…"
                inputMode="url"
                {...form.register("mapsUrl")}
              />
            </div>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-primary" /> Menu
          </CardTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Isi minimal salah satu: teks menu atau screenshot.
          </p>
        </CardHeader>
        <CardBody className="space-y-3.5">
          <Field
            label="Teks menu"
            hint={`${form.watch("menuText")?.length ?? 0}/${LIMITS.menuText}`}
            error={form.formState.errors.menuText?.message}
          >
            <Textarea
              rows={7}
              placeholder={"Makanan:\n- Nasi Goreng 25.000\n\nMinuman:\n- Es Teh 5.000"}
              {...form.register("menuText")}
            />
          </Field>

          <Field label="Screenshot menu" hint="JPG/PNG, maks 5 MB">
            {imagePreview || existingImage ? (
              <div className="relative overflow-hidden rounded-md border border-border">
                <img
                  src={imagePreview ?? existingImage ?? ""}
                  alt="Preview menu"
                  className="max-h-64 w-full object-contain bg-muted/40"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={() => {
                    setImageFile(null);
                    setRemoveImage(true);
                  }}
                  aria-label="Hapus gambar"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:border-primary/40">
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
                <span className="text-[13px] font-medium">Pilih gambar menu</span>
                <span className="text-2xs text-muted-foreground">Gambar dikompres otomatis</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImageFile(file);
                    setRemoveImage(false);
                  }}
                />
              </label>
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" /> Batas waktu
          </CardTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Waktu Asia/Jakarta (WIB). Deadline diperiksa di server.
          </p>
        </CardHeader>
        <CardBody className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Batas voting" error={form.formState.errors.voteDeadline?.message}>
            <Input type="datetime-local" {...form.register("voteDeadline")} />
          </Field>
          <Field label="Batas isi form" error={form.formState.errors.orderDeadline?.message}>
            <Input type="datetime-local" {...form.register("orderDeadline")} />
          </Field>
        </CardBody>
      </Card>

      <FormError>{error}</FormError>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(voteId ? `/votes/${voteId}` : `/groups/${activeGroupId}`)}
        >
          Batal
        </Button>
        <Button type="submit" loading={busy}>
          {isEdit ? "Simpan perubahan" : "Buat voting"}
        </Button>
      </div>
    </form>
  );
}
