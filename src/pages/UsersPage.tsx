import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Power, Trash2, RefreshCw, UserCircle } from "lucide-react";
import { PageHeader, PageContent } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useListQuery } from "@/lib/useListQuery";
import { apiFetch, ApiError } from "@/lib/api";

interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  enabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Jamais";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UsersPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const t = useListQuery<AdminUser>({
    resource: "users",
    path: "/api/users",
    pageSize: 50,
  });

  const toggle = useMutation({
    mutationFn: (u: AdminUser) =>
      apiFetch<AdminUser>(`/api/users/${u.id}`, {
        method: "PATCH",
        body: { enabled: !u.enabled },
      }),
    onSuccess: (updated) => {
      toast.success(
        updated.enabled
          ? `${updated.email} activé`
          : `${updated.email} désactivé`,
      );
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast.error("Échec", { description: (err as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Utilisateur supprimé");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      toast.error("Suppression refusée", {
        description: (err as Error).message,
      }),
  });

  const columns: Column<AdminUser>[] = [
    {
      key: "email",
      header: "Email",
      mono: true,
      cell: (u) => u.email,
    },
    {
      key: "name",
      header: "Nom",
      width: "w-40",
      hideOnMobile: true,
      cell: (u) =>
        u.name ?? <span className="text-[var(--color-fg-subtle)]">—</span>,
    },
    {
      key: "last_login",
      header: "Dernière connexion",
      width: "w-40",
      hideOnMobile: true,
      cell: (u) => (
        <span
          className={u.last_login_at ? "" : "text-[var(--color-fg-subtle)]"}
        >
          {formatDateTime(u.last_login_at)}
        </span>
      ),
    },
    {
      key: "enabled",
      header: "État",
      width: "w-28",
      cell: (u) =>
        u.enabled ? (
          <Badge tone="success">Actif</Badge>
        ) : (
          <Badge tone="neutral">Désactivé</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      width: "w-28",
      align: "right",
      cell: (u) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={toggle.isPending}
            onClick={async (e) => {
              e.stopPropagation();
              if (u.enabled) {
                const ok = await confirm({
                  title: "Désactiver cet utilisateur ?",
                  description: (
                    <>
                      <span className="font-mono">{u.email}</span> ne pourra
                      plus se connecter à la console tant que son compte sera
                      désactivé.
                    </>
                  ),
                  confirmLabel: "Désactiver",
                  tone: "danger",
                });
                if (!ok) return;
              }
              toggle.mutate(u);
            }}
            title={u.enabled ? "Désactiver" : "Activer"}
            aria-label={u.enabled ? "Désactiver" : "Activer"}
          >
            <Power size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await confirm({
                title: "Supprimer cet utilisateur ?",
                description: (
                  <>
                    <span className="font-mono">{u.email}</span> sera
                    définitivement supprimé et perdra tout accès à la console.
                  </>
                ),
                confirmLabel: "Supprimer",
                tone: "danger",
              });
              if (ok) remove.mutate(u.id);
            }}
            title="Supprimer"
            aria-label="Supprimer"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle="Emails autorisés à accéder à la console (via magic link)."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => t.refetch()}
            disabled={t.fetching}
          >
            <RefreshCw size={14} className={t.fetching ? "animate-spin" : ""} />
            Rafraîchir
          </Button>
        }
      />
      <PageContent>
        <AddUserForm
          onCreated={() => qc.invalidateQueries({ queryKey: ["users"] })}
        />

        <DataTable
          columns={columns}
          rows={t.data.items}
          rowKey={(u) => u.id}
          loading={t.loading}
          error={t.error as Error | null}
          searchPlaceholder="Rechercher par email ou nom…"
          emptyMessage="Aucun utilisateur. Ajoute-en un pour autoriser l'accès."
          {...t.tableProps}
        />
      </PageContent>
    </>
  );
}

interface AddFormProps {
  onCreated: () => void;
}

function AddUserForm({ onCreated }: AddFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      apiFetch<AdminUser>("/api/users", {
        method: "POST",
        body: { email: email.trim(), name: name.trim() || null, enabled: true },
      }),
    onSuccess: (created) => {
      toast.success("Utilisateur ajouté", { description: created.email });
      setEmail("");
      setName("");
      setError(null);
      onCreated();
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : String(err);
      setError(msg);
      toast.error("Ajout refusé", { description: msg });
    },
  });

  return (
    <Card>
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) create.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-none">
            <UserCircle
              size={20}
              className="text-[var(--color-fg-muted)] mb-3.5"
            />
          </div>
          <label className="flex-1 min-w-[220px]">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Email
            </span>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@gmail.com"
              className="font-mono"
              type="email"
            />
          </label>
          <label className="flex-1 min-w-[180px]">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Nom (optionnel)
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
            />
          </label>
          <Button
            type="submit"
            variant="accent"
            disabled={!email.trim() || create.isPending}
          >
            <Plus size={14} />
            Ajouter
          </Button>
        </form>
        {error && (
          <div className="mt-3 text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded px-3 py-2">
            {error}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
