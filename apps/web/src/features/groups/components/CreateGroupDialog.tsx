import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Field, FormError, Input } from "../../../components/ui/form";
import { errorMessage } from "../../../lib/api";
import { toast } from "../../../lib/store";
import { useCreateGroup } from "../queries";

const schema = z.object({
  name: z.string().trim().min(2, "Nama grup minimal 2 karakter").max(100),
});
type Values = z.infer<typeof schema>;

export function CreateGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "" } });
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateGroup();

  const close = () => {
    form.reset();
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Buat grup"
      description="Grup mewadahi anggota dan voting tempat makan."
    >
      <form
        className="space-y-3.5"
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          mutation.mutate(
            { name: values.name },
            {
              onSuccess: () => {
                toast("Grup dibuat", { variant: "success" });
                close();
              },
              onError: (err) => setError(errorMessage(err)),
            },
          );
        })}
      >
        <Field label="Nama grup" error={form.formState.errors.name?.message}>
          <Input autoFocus placeholder="Contoh: Kantor Senja" {...form.register("name")} />
        </Field>
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={close}>
            Batal
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Buat grup
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
