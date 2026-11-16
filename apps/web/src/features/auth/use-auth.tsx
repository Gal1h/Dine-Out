import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthMeResponse, Role } from "@dineout/shared";
import { api, ApiError } from "../../lib/api";

interface AuthContextValue {
  me: AuthMeResponse | null;
  isLoading: boolean;
  isAdminAccount: boolean;
  role: Role | null;
  groupId: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery<AuthMeResponse | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<AuthMeResponse>("/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [queryClient]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    queryClient.setQueryData(["me"], null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
  }, [queryClient]);

  useEffect(() => {
    const handler = () => {
      queryClient.setQueryData(["me"], null);
    };
    window.addEventListener("dineout:session-expired", handler);
    return () => window.removeEventListener("dineout:session-expired", handler);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const me = query.data ?? null;
    return {
      me,
      isLoading: query.isLoading,
      isAdminAccount: me?.user.accountType === "admin",
      role: me?.group?.role ?? (me?.user.accountType === "admin" ? "admin" : null),
      groupId: me?.group?.id ?? null,
      refresh,
      logout,
    };
  }, [query.data, query.isLoading, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return context;
}
